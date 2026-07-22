// ════════════════════════════════════════════════════════════════════════
// Offline Event admin edge function (nested in the Admin Portal).
//
// EVERY action is gated by requireAdmin() first — validates the caller's session
// JWT + checks the platform_admins allowlist, before any privileged work runs
// with the service role. Callable with the public anon key (verify_jwt off at the
// gateway) because requireAdmin is the real, server-enforced gate. Kept separate
// from the platform `admin` fn (mirrors how `rb` / `helpdesk-admin` are separate)
// so each stays lean. The frontend NEVER touches the RLS-locked oe_ tables directly.
//
// P2 ships `overview` only (live counts — also a visible confirmation the P1 seed
// landed). Real CRUD (bookings / events / check-in / floor plans / settings) lands
// from P6 onwards.
// ════════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, serviceClient } from "../_shared/ghl.ts";
import { requireAdmin } from "../_shared/admin.ts";

// Best-effort audit trail for admin write actions (who changed what, when).
// Never blocks the action if logging fails.
// deno-lint-ignore no-explicit-any
async function logAudit(
  sb: any,
  admin: { user_id?: string; email?: string },
  action: string,
  detail: Record<string, unknown>,
  targetLocationId?: string | null,
) {
  try {
    await sb.from("admin_audit_log").insert({
      admin_user_id: admin?.user_id ?? null,
      admin_email: admin?.email ?? null,
      action,
      target_location_id: targetLocationId ?? null,
      tool_key: "offline_event",
      detail,
    });
  } catch (e) {
    console.error("audit log failed:", e);
  }
}

/** Short, human-scannable booking code (mirrors the `oe` fn's generator). */
function genBookingId(): string {
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BK-${ts}-${rand}`;
}

/** QR payload — MUST match the `oe` fn's shape so the check-in scanner + QrTicket
 *  read it identically (check-in keys off bookingId; the rest is display). */
function buildQrPayload(o: {
  bookingId: string; email: string; phone: string; eventId: string; eventLabel: string; totalSeats: number;
}): string {
  return JSON.stringify({
    v: 1, bookingId: o.bookingId, email: o.email, phone: o.phone,
    eventId: o.eventId, eventLabel: o.eventLabel, totalSeats: o.totalSeats,
  });
}

/** Sanitize an event payload from the admin form into an oe_events row.
 *  capacity: blank/null → NULL (derive from floor plan). */
// deno-lint-ignore no-explicit-any
function buildEventRow(p: any): Record<string, unknown> {
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const capRaw = p?.capacity;
  const capacity =
    capRaw === null || capRaw === undefined || String(capRaw).trim() === ""
      ? null
      : Math.max(0, Math.floor(Number(capRaw)) || 0);
  const status = ["live", "display", "off"].includes(p?.status) ? p.status : "live";
  return {
    display_label: String(p?.display_label || "").trim(),
    start_date: String(p?.start_date || "").trim(),
    end_date: String(p?.end_date || "").trim(),
    time_slot: String(p?.time_slot || "").trim(),
    theme_zh: p?.theme_zh ? String(p.theme_zh) : null,
    theme_en: p?.theme_en ? String(p.theme_en) : null,
    notice_zh: p?.notice_zh ? String(p.notice_zh) : null,
    notice_en: p?.notice_en ? String(p.notice_en) : null,
    price_per_seat: Math.max(0, num(p?.price_per_seat)),
    capacity,
    floor_plan_id: p?.floor_plan_id ? String(p.floor_plan_id) : null,
    seat_selection_enabled: p?.seat_selection_enabled !== false,
    status,
    sort_order: Math.floor(num(p?.sort_order)),
  };
}

/** Shared validation for create/update event. Returns an error key or null. */
// deno-lint-ignore no-explicit-any
function validateEvent(p: any): string | null {
  if (!String(p?.display_label || "").trim()) return "label_required";
  const s = String(p?.start_date || "").trim();
  const e = String(p?.end_date || "").trim();
  if (!s || !e) return "dates_required";
  if (e < s) return "end_before_start";
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // The one gate: validate session JWT + allowlist BEFORE any service-role work.
    const admin = await requireAdmin(req);
    if (!admin) return json({ error: "not_authorized" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const sb = serviceClient();

    switch (action) {
      // ── Live counts for the admin landing ───────────────────────────────
      // Cap-free COUNT queries (head:true → never truncated). Also serves as a
      // visible confirmation that the P1 seed landed (events / floor plans > 0).
      case "overview": {
        const count = (table: string) =>
          sb.from(table).select("id", { count: "exact", head: true });
        const countWhere = (table: string, col: string, val: string) =>
          sb.from(table).select("id", { count: "exact", head: true }).eq(col, val);

        const [
          eventsTotal,
          eventsLive,
          floorPlans,
          bookingsTotal,
          bookingsConfirmed,
          bookingsPending,
          seatsClaimed,
        ] = await Promise.all([
          count("oe_events"),
          countWhere("oe_events", "status", "live"),
          count("oe_floor_plans"),
          count("oe_bookings"),
          countWhere("oe_bookings", "status", "confirmed"),
          countWhere("oe_bookings", "status", "pending"),
          count("oe_booked_seats"),
        ]);

        // Revenue = sum of CONFIRMED bookings' totals (MYR). Summed here since
        // PostgREST has no head-count SUM. Fine at low volume — PROGRESS pre-scale
        // TODO: move to a SQL sum RPC before high booking volume.
        const { data: paid, error: revErr } = await sb
          .from("oe_bookings")
          .select("total")
          .eq("status", "confirmed")
          .limit(5000);
        if (revErr) throw revErr;
        const revenue = (paid ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0);

        return json({
          overview: {
            counts: {
              eventsTotal: eventsTotal.count ?? 0,
              eventsLive: eventsLive.count ?? 0,
              floorPlans: floorPlans.count ?? 0,
              bookingsTotal: bookingsTotal.count ?? 0,
              bookingsConfirmed: bookingsConfirmed.count ?? 0,
              bookingsPending: bookingsPending.count ?? 0,
              seatsClaimed: seatsClaimed.count ?? 0,
            },
            revenue,
          },
        });
      }

      // ── Check-in: events to choose the "active" event from ──────────────
      // The admin picks which event's door they're on; scans are then locked
      // to it (a ticket for another event is refused — see checkIn). Returns
      // all events (any status) newest work-friendly by start_date.
      case "checkinEvents": {
        const { data, error } = await sb
          .from("oe_events")
          .select("id, display_label, start_date, end_date, time_slot, theme_zh, theme_en, status")
          .order("start_date", { ascending: true });
        if (error) throw error;
        return json({ events: data ?? [] });
      }

      // ── Check-in: live board for a selected event + day ─────────────────
      // total = confirmed tickets for the event; attended = those checked in
      // that day; recent = latest check-ins (for the door-side "just arrived"
      // list). Called on load and after every scan so the count stays live.
      case "checkinBoard": {
        const eventId = String(body?.eventId || "");
        const day = Number(body?.day) === 2 ? 2 : 1;
        if (!eventId) return json({ error: "event_required" }, 400);
        const dayCol = day === 2 ? "day2_status" : "day1_status";
        const atCol = day === 2 ? "day2_checked_in_at" : "day1_checked_in_at";

        const base = () =>
          sb.from("oe_bookings").select("id", { count: "exact", head: true })
            .eq("event_id", eventId).eq("status", "confirmed");
        const [totalQ, attendedQ] = await Promise.all([
          base(),
          base().eq(dayCol, "attended"),
        ]);

        const { data: recent, error: recErr } = await sb
          .from("oe_bookings")
          .select(`booking_id, email, free_seats, addon_seats, ${atCol}`)
          .eq("event_id", eventId).eq("status", "confirmed").eq(dayCol, "attended")
          .order(atCol, { ascending: false })
          .limit(20);
        if (recErr) throw recErr;

        return json({
          board: {
            total: totalQ.count ?? 0,
            attended: attendedQ.count ?? 0,
            recent: (recent ?? []).map((r: Record<string, unknown>) => ({
              booking_id: r.booking_id,
              email: r.email,
              seats: [
                ...((r.free_seats as string[]) ?? []),
                ...((r.addon_seats as string[]) ?? []),
              ],
              checkedInAt: r[atCol] ?? null,
            })),
          },
        });
      }

      // ── Check-in: mark a booking attended for a day (IDEMPOTENT) ─────────
      // Find the confirmed booking by its human code. Guard against scanning a
      // ticket from a DIFFERENT event (locked to the selected event). Flip the
      // day's status pending→attended ONLY when still pending (a re-scan, or a
      // second device scanning at the same instant, changes nothing and reports
      // "already"). So repeat scans never double-count.
      case "checkIn": {
        const code = String(body?.bookingId || "").trim();
        const eventId = String(body?.eventId || "");
        const day = Number(body?.day) === 2 ? 2 : 1;
        if (!code) return json({ result: "not_found" });
        const dayCol = day === 2 ? "day2_status" : "day1_status";
        const atCol = day === 2 ? "day2_checked_in_at" : "day1_checked_in_at";

        const { data: b, error: findErr } = await sb
          .from("oe_bookings")
          .select(
            "id, booking_id, event_id, event_label, email, status, free_seats, addon_seats, day1_status, day2_status, day1_checked_in_at, day2_checked_in_at",
          )
          .eq("booking_id", code)
          .maybeSingle();
        if (findErr) throw findErr;
        if (!b || b.status !== "confirmed") return json({ result: "not_found", code });

        const info = {
          booking_id: b.booking_id,
          email: b.email,
          seats: [...((b.free_seats as string[]) ?? []), ...((b.addon_seats as string[]) ?? [])],
          event_label: b.event_label,
          day,
        };

        // Locked to the chosen event — a ticket for another event is refused.
        if (eventId && b.event_id !== eventId) {
          return json({ result: "wrong_event", booking: info, scannedEventLabel: b.event_label });
        }

        const curStatus = day === 2 ? b.day2_status : b.day1_status;
        const curAt = day === 2 ? b.day2_checked_in_at : b.day1_checked_in_at;
        if (curStatus === "attended") {
          return json({ result: "already", booking: { ...info, checkedInAt: curAt } });
        }

        const nowIso = new Date().toISOString();
        const { data: upd, error: updErr } = await sb
          .from("oe_bookings")
          .update({ [dayCol]: "attended", [atCol]: nowIso, updated_at: nowIso })
          .eq("id", b.id)
          .eq(dayCol, "pending") // idempotency guard — flips at most once
          .select("id")
          .maybeSingle();
        if (updErr) throw updErr;
        // Lost a race (marked between our read and write) → treat as already.
        if (!upd) return json({ result: "already", booking: { ...info, checkedInAt: curAt ?? nowIso } });

        return json({ result: "ok", booking: { ...info, checkedInAt: nowIso } });
      }

      // ═══ P7a — Bookings management ═════════════════════════════════════

      // ── List bookings (filters + search + total count) ───────────────────
      case "listBookings": {
        const eventId = String(body?.eventId || "").trim();
        const status = String(body?.status || "").trim();
        const locId = String(body?.locationId || "").trim();
        const includeArchived = body?.includeArchived === true;
        const limit = Math.min(500, Math.max(1, Math.floor(Number(body?.limit) || 200)));
        // Sanitize search so it can't break the PostgREST or() filter syntax.
        const search = String(body?.search || "").replace(/[^a-zA-Z0-9@._\- ]/g, "").trim();

        let q = sb
          .from("oe_bookings")
          .select(
            "booking_id, email, phone, event_id, event_label, free_seats, addon_seats, lunch_qty, subtotal, sst_amount, total, status, payment_note, receipt_url, day1_status, day2_status, day1_checked_in_at, day2_checked_in_at, ghl_location_id, is_archived, created_at",
            { count: "exact" },
          );
        if (!includeArchived) q = q.eq("is_archived", false);
        if (eventId) q = q.eq("event_id", eventId);
        if (status) q = q.eq("status", status);
        if (locId) q = q.eq("ghl_location_id", locId);
        if (search) q = q.or(`booking_id.ilike.%${search}%,email.ilike.%${search}%`);
        q = q.order("created_at", { ascending: false }).limit(limit);

        const { data, error, count } = await q;
        if (error) throw error;
        // deno-lint-ignore no-explicit-any
        const bookings = (data ?? []).map((b: any) => ({
          ...b,
          seats: [...((b.free_seats as string[]) ?? []), ...((b.addon_seats as string[]) ?? [])],
        }));
        return json({ bookings, total: count ?? bookings.length });
      }

      // ── One booking's full detail + its event ────────────────────────────
      case "getBookingDetail": {
        const code = String(body?.bookingId || "").trim();
        if (!code) return json({ error: "booking_required" }, 400);
        const { data: b, error } = await sb.from("oe_bookings").select("*").eq("booking_id", code).maybeSingle();
        if (error) throw error;
        if (!b) return json({ error: "not_found" }, 404);
        let event = null;
        if (b.event_id) {
          const { data: ev } = await sb
            .from("oe_events")
            .select(
              "id, display_label, start_date, end_date, time_slot, price_per_seat, status, floor_plan_id, seat_selection_enabled",
            )
            .eq("id", b.event_id)
            .maybeSingle();
          event = ev ?? null;
        }
        return json({
          booking: { ...b, seats: [...((b.free_seats as string[]) ?? []), ...((b.addon_seats as string[]) ?? [])] },
          event,
        });
      }

      // ── Cancel a booking (void + free its seats; keep the row) ───────────
      // Two-action model: cancel frees seats + marks the row cancelled (kept for
      // history); archive (below) only hides. Idempotent — cancelling twice is safe.
      case "cancelBooking": {
        const code = String(body?.bookingId || "").trim();
        if (!code) return json({ error: "booking_required" }, 400);
        const { data: b, error } = await sb
          .from("oe_bookings")
          .select("id, status, payment_note, ghl_location_id")
          .eq("booking_id", code)
          .maybeSingle();
        if (error) throw error;
        if (!b) return json({ error: "not_found" }, 404);
        if (b.status === "cancelled") return json({ ok: true, alreadyCancelled: true });

        // Free the held seats so they become bookable again (keep the booking row).
        await sb.from("oe_booked_seats").delete().eq("booking_id", b.id);
        const nowIso = new Date().toISOString();
        const note = `${b.payment_note ? b.payment_note + " · " : ""}已取消(管理员)`;
        const { error: upErr } = await sb
          .from("oe_bookings")
          .update({ status: "cancelled", payment_note: note, updated_at: nowIso })
          .eq("id", b.id);
        if (upErr) throw upErr;
        await logAudit(sb, admin, "oe_cancel_booking", { booking_id: code, from: b.status }, b.ghl_location_id);
        return json({ ok: true });
      }

      // ── Archive / un-archive a booking (hide from the active list) ───────
      case "archiveBooking": {
        const code = String(body?.bookingId || "").trim();
        const archived = body?.archived !== false; // default true
        if (!code) return json({ error: "booking_required" }, 400);
        const nowIso = new Date().toISOString();
        const { data, error } = await sb
          .from("oe_bookings")
          .update({ is_archived: archived, archived_at: archived ? nowIso : null, updated_at: nowIso })
          .eq("booking_id", code)
          .select("id, ghl_location_id")
          .maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "not_found" }, 404);
        await logAudit(sb, admin, "oe_archive_booking", { booking_id: code, archived }, data.ghl_location_id);
        return json({ ok: true, archived });
      }

      // ═══ P7a-2 — Manual add-ticket + change-seat + change-date ═════════════

      // ── Sub-accounts (for the manual add-ticket location picker) ─────────
      case "listLocations": {
        const { data, error } = await sb
          .from("ghl_locations")
          .select("location_id, business_name")
          .order("business_name", { ascending: true })
          .limit(1000);
        if (error) throw error;
        return json({ locations: data ?? [] });
      }

      // ── Seat map for an event (for the admin seat picker) ────────────────
      // Returns the floor-plan layout + already-claimed seat labels. When
      // `excludeBookingId` is given (change-seat), that booking's OWN seats are
      // omitted from the claimed set so they show free + can be re-selected.
      case "getEventSeatmap": {
        const eventId = String(body?.eventId || "").trim();
        if (!eventId) return json({ error: "event_required" }, 400);
        const { data: ev, error } = await sb
          .from("oe_events")
          .select("id, display_label, start_date, end_date, price_per_seat, capacity, floor_plan_id, seat_selection_enabled, status")
          .eq("id", eventId)
          .maybeSingle();
        if (error) throw error;
        if (!ev) return json({ error: "event_not_found" }, 404);

        let layout: unknown = null;
        if (ev.floor_plan_id) {
          const { data: fp } = await sb.from("oe_floor_plans").select("layout_data").eq("id", ev.floor_plan_id).maybeSingle();
          layout = fp?.layout_data ?? null;
        }

        let ownUuid: string | null = null;
        const excludeBookingId = String(body?.excludeBookingId || "").trim();
        if (excludeBookingId) {
          const { data: bk } = await sb.from("oe_bookings").select("id").eq("booking_id", excludeBookingId).maybeSingle();
          ownUuid = (bk?.id as string) ?? null;
        }
        const { data: claimed } = await sb.from("oe_booked_seats").select("seat_label, booking_id").eq("event_id", eventId);
        const bookedLabels = (claimed ?? [])
          .filter((r) => !ownUuid || r.booking_id !== ownUuid)
          .map((r) => r.seat_label as string);

        return json({ event: ev, layout, bookedLabels });
      }

      // ── Manual add-ticket (3rd-party / offline payment) ──────────────────
      // Admin creates a CONFIRMED booking directly. Seats → addon_seats (so it
      // does NOT consume the location's free allowance). Payment is a note only
      // (no Stripe). Seats claimed atomically via the P4 oe_claim_seats RPC.
      case "addBooking": {
        const locId = String(body?.locationId || "").trim();
        const eventId = String(body?.eventId || "").trim();
        const email = String(body?.email || "").trim();
        const phone = String(body?.phone || "").trim();
        const note = String(body?.note || "").trim();
        const amount = Number(body?.amount) || 0;
        const lunchQty = Math.max(0, Math.floor(Number(body?.lunchQty) || 0));
        const seats: string[] = Array.isArray(body?.seats) ? body.seats.map((s: unknown) => String(s).trim()).filter(Boolean) : [];
        const uniqSeats = [...new Set(seats)];
        if (!locId) return json({ error: "location_required" }, 400);
        if (!eventId) return json({ error: "event_required" }, 400);
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "email_required" }, 400);
        if (uniqSeats.length < 1) return json({ error: "no_seats" }, 400);

        const { data: ev } = await sb.from("oe_events").select("id, display_label").eq("id", eventId).maybeSingle();
        if (!ev) return json({ error: "event_not_found" }, 404);

        const bookingId = genBookingId();
        const qr = buildQrPayload({ bookingId, email, phone, eventId, eventLabel: ev.display_label, totalSeats: uniqSeats.length });
        const { data: inserted, error: insErr } = await sb
          .from("oe_bookings")
          .insert({
            booking_id: bookingId,
            event_id: eventId,
            event_label: ev.display_label,
            email,
            phone,
            free_seats: [],
            addon_seats: uniqSeats,
            lunch_qty: lunchQty,
            subtotal: amount || 0,
            sst_amount: 0,
            total: amount || 0,
            status: "confirmed",
            qr_payload: qr,
            ghl_location_id: locId,
            payment_note: note || "手动加票(管理员)",
            created_by: "admin",
          })
          .select("id")
          .single();
        if (insErr) throw insErr;

        const { data: claimed, error: claimErr } = await sb.rpc("oe_claim_seats", {
          p_event_id: eventId,
          p_booking_id: inserted.id,
          p_seats: uniqSeats,
        });
        if (claimErr) {
          await sb.from("oe_bookings").delete().eq("id", inserted.id);
          throw claimErr;
        }
        if (claimed !== true) {
          await sb.from("oe_bookings").delete().eq("id", inserted.id);
          return json({ error: "seats_unavailable" }, 409);
        }

        await logAudit(sb, admin, "oe_add_booking", { booking_id: bookingId, event_id: eventId, seats: uniqSeats, amount }, locId);
        return json({
          ok: true,
          booking: { booking_id: bookingId, qr_payload: qr, seats: uniqSeats, event_label: ev.display_label, total: amount || 0 },
        });
      }

      // ── Change-seat: swap seats within the SAME event (atomic, same count) ──
      case "changeSeats": {
        const code = String(body?.bookingId || "").trim();
        const seats: string[] = Array.isArray(body?.seats) ? body.seats.map((s: unknown) => String(s).trim()).filter(Boolean) : [];
        const uniqSeats = [...new Set(seats)];
        if (!code) return json({ error: "booking_required" }, 400);
        const { data: b } = await sb
          .from("oe_bookings")
          .select("id, event_id, status, free_seats, addon_seats, ghl_location_id")
          .eq("booking_id", code)
          .maybeSingle();
        if (!b) return json({ error: "not_found" }, 404);
        if (b.status === "cancelled") return json({ error: "cancelled_booking" }, 400);
        if (!b.event_id) return json({ error: "no_event" }, 400);
        const curCount = (b.free_seats?.length ?? 0) + (b.addon_seats?.length ?? 0);
        if (uniqSeats.length !== curCount) return json({ error: "seat_count_mismatch", required: curCount }, 400);

        const { data: ok, error: rpcErr } = await sb.rpc("oe_reassign_seats", {
          p_event_id: b.event_id,
          p_booking_id: b.id,
          p_new_seats: uniqSeats,
        });
        if (rpcErr) throw rpcErr;
        if (ok !== true) return json({ error: "seats_unavailable" }, 409);

        // Preserve the free/paid split SIZES (keeps free-allowance accounting stable); relabel.
        const freeCount = b.free_seats?.length ?? 0;
        await sb
          .from("oe_bookings")
          .update({ free_seats: uniqSeats.slice(0, freeCount), addon_seats: uniqSeats.slice(freeCount), updated_at: new Date().toISOString() })
          .eq("id", b.id);
        await logAudit(sb, admin, "oe_change_seats", { booking_id: code, seats: uniqSeats }, b.ghl_location_id);
        return json({ ok: true });
      }

      // ── Change-date: move a booking to another event (atomic, same count) ──
      case "changeEvent": {
        const code = String(body?.bookingId || "").trim();
        const newEventId = String(body?.newEventId || "").trim();
        const seats: string[] = Array.isArray(body?.seats) ? body.seats.map((s: unknown) => String(s).trim()).filter(Boolean) : [];
        const uniqSeats = [...new Set(seats)];
        if (!code) return json({ error: "booking_required" }, 400);
        if (!newEventId) return json({ error: "event_required" }, 400);
        const { data: b } = await sb
          .from("oe_bookings")
          .select("id, event_id, status, free_seats, addon_seats, email, phone, ghl_location_id")
          .eq("booking_id", code)
          .maybeSingle();
        if (!b) return json({ error: "not_found" }, 404);
        if (b.status === "cancelled") return json({ error: "cancelled_booking" }, 400);
        const curCount = (b.free_seats?.length ?? 0) + (b.addon_seats?.length ?? 0);
        if (uniqSeats.length !== curCount) return json({ error: "seat_count_mismatch", required: curCount }, 400);

        const { data: ev } = await sb.from("oe_events").select("id, display_label").eq("id", newEventId).maybeSingle();
        if (!ev) return json({ error: "event_not_found" }, 404);

        // Same event chosen → this is really a seat change.
        const sameEvent = b.event_id === newEventId;
        const { data: ok, error: rpcErr } = sameEvent
          ? await sb.rpc("oe_reassign_seats", { p_event_id: newEventId, p_booking_id: b.id, p_new_seats: uniqSeats })
          : await sb.rpc("oe_move_booking_seats", { p_old_event_id: b.event_id, p_new_event_id: newEventId, p_booking_id: b.id, p_new_seats: uniqSeats });
        if (rpcErr) throw rpcErr;
        if (ok !== true) return json({ error: "seats_unavailable" }, 409);

        // Keep booking_id stable (customer's existing QR still scans); refresh
        // event_id/label + regenerate the QR payload; preserve free/paid split.
        const freeCount = b.free_seats?.length ?? 0;
        const qr = buildQrPayload({
          bookingId: code, email: b.email ?? "", phone: b.phone ?? "",
          eventId: newEventId, eventLabel: ev.display_label, totalSeats: uniqSeats.length,
        });
        await sb
          .from("oe_bookings")
          .update({
            event_id: newEventId,
            event_label: ev.display_label,
            free_seats: uniqSeats.slice(0, freeCount),
            addon_seats: uniqSeats.slice(freeCount),
            qr_payload: qr,
            updated_at: new Date().toISOString(),
          })
          .eq("id", b.id);
        await logAudit(sb, admin, "oe_change_event", { booking_id: code, from: b.event_id, to: newEventId, seats: uniqSeats }, b.ghl_location_id);
        return json({ ok: true });
      }

      // ═══ P7b — Event-date management ═══════════════════════════════════════

      // ── List ALL events (any status) + claimed/booking counts + plans ────
      case "listEventsAdmin": {
        const { data: events, error } = await sb
          .from("oe_events")
          .select("*")
          .order("sort_order", { ascending: true })
          .order("start_date", { ascending: true });
        if (error) throw error;
        const evs = events ?? [];
        const ids = evs.map((e) => e.id as string);

        const claimed: Record<string, number> = {};
        const bookings: Record<string, number> = {};
        if (ids.length) {
          const { data: seats } = await sb.from("oe_booked_seats").select("event_id").in("event_id", ids);
          for (const s of seats ?? []) claimed[s.event_id as string] = (claimed[s.event_id as string] || 0) + 1;
          const { data: bks } = await sb.from("oe_bookings").select("event_id, status").in("event_id", ids).neq("status", "cancelled");
          for (const b of bks ?? []) if (b.event_id) bookings[b.event_id as string] = (bookings[b.event_id as string] || 0) + 1;
        }

        const { data: plans } = await sb.from("oe_floor_plans").select("id, name, physical_seats").order("name", { ascending: true });
        const planName: Record<string, string> = {};
        for (const p of plans ?? []) planName[p.id as string] = p.name as string;

        const out = evs.map((e) => ({
          ...e,
          claimed_seats: claimed[e.id as string] || 0,
          booking_count: bookings[e.id as string] || 0,
          floor_plan_name: e.floor_plan_id ? planName[e.floor_plan_id as string] ?? null : null,
        }));
        return json({ events: out, floorPlans: plans ?? [] });
      }

      // ── Create an event ──────────────────────────────────────────────────
      case "createEvent": {
        const p = body?.event ?? {};
        const invalid = validateEvent(p);
        if (invalid) return json({ error: invalid }, 400);
        const { data, error } = await sb.from("oe_events").insert(buildEventRow(p)).select("id").single();
        if (error) throw error;
        await logAudit(sb, admin, "oe_create_event", { event_id: data.id, label: String(p.display_label) });
        return json({ ok: true, id: data.id });
      }

      // ── Update an event (with capacity / floor-plan guards) ──────────────
      case "updateEvent": {
        const id = String(body?.id || "").trim();
        const p = body?.event ?? {};
        if (!id) return json({ error: "id_required" }, 400);
        const invalid = validateEvent(p);
        if (invalid) return json({ error: invalid }, 400);

        const { data: cur } = await sb.from("oe_events").select("id, floor_plan_id").eq("id", id).maybeSingle();
        if (!cur) return json({ error: "not_found" }, 404);

        const { count: claimedCount } = await sb
          .from("oe_booked_seats").select("id", { count: "exact", head: true }).eq("event_id", id);
        const claimedN = claimedCount ?? 0;

        // Capacity can't drop below seats already claimed.
        const capRaw = p.capacity;
        if (capRaw !== null && capRaw !== undefined && String(capRaw).trim() !== "") {
          const capN = Math.floor(Number(capRaw));
          if (Number.isFinite(capN) && capN < claimedN) return json({ error: "capacity_below_claimed", claimed: claimedN }, 400);
        }
        // Can't swap the floor plan out from under existing seat claims.
        const newPlan = p.floor_plan_id ? String(p.floor_plan_id) : null;
        if (claimedN > 0 && newPlan !== (cur.floor_plan_id ?? null)) {
          return json({ error: "cannot_change_plan_with_bookings", claimed: claimedN }, 400);
        }

        const { error } = await sb.from("oe_events").update({ ...buildEventRow(p), updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        await logAudit(sb, admin, "oe_update_event", { event_id: id });
        return json({ ok: true });
      }

      // ── Delete an event (blocked when it has active bookings) ────────────
      case "deleteEvent": {
        const id = String(body?.id || "").trim();
        if (!id) return json({ error: "id_required" }, 400);
        const { count } = await sb
          .from("oe_bookings").select("id", { count: "exact", head: true }).eq("event_id", id).neq("status", "cancelled");
        if ((count ?? 0) > 0) return json({ error: "has_bookings", count: count ?? 0 }, 400);
        const { error } = await sb.from("oe_events").delete().eq("id", id);
        if (error) throw error;
        await logAudit(sb, admin, "oe_delete_event", { event_id: id });
        return json({ ok: true });
      }

      // ═══ P7c — Settings ════════════════════════════════════════════════════

      // ── Read settings (+ live-key status + pending count for the UI) ─────
      case "getSettings": {
        const { data } = await sb.from("oe_settings").select("key, value");
        const m: Record<string, string> = {};
        for (const r of data ?? []) m[r.key as string] = r.value as string;
        const get = (k: string, d: string) => (m[k] !== undefined ? m[k] : d);

        const { count: pendingCount } = await sb.from("oe_bookings").select("id", { count: "exact", head: true }).eq("status", "pending");
        const liveKeyConfigured = !!(Deno.env.get("OE_STRIPE_SECRET_KEY_LIVE") ?? "");

        return json({
          settings: {
            stripe_payment_mode: get("stripe_payment_mode", "sandbox"),
            sst_rate: get("sst_rate", "0.08"),
            lunch_price: get("lunch_price", "39.99"),
            max_seats_per_booking: get("max_seats_per_booking", "4"),
            default_free_tickets: get("default_free_tickets", "1"),
            default_free_seats: get("default_free_seats", "2"),
          },
          liveKeyConfigured,
          pendingCount: pendingCount ?? 0,
        });
      }

      // ── Update the non-Stripe-mode settings (numeric, validated) ─────────
      case "updateSettings": {
        const p = body?.settings ?? {};
        const allowed = ["sst_rate", "lunch_price", "max_seats_per_booking", "default_free_tickets", "default_free_seats"];
        const nowIso = new Date().toISOString();
        const rows: { key: string; value: string; updated_at: string }[] = [];
        for (const k of allowed) {
          if (p[k] === undefined || p[k] === null || String(p[k]).trim() === "") continue;
          let v = Number(p[k]);
          if (!Number.isFinite(v) || v < 0) return json({ error: `invalid_${k}` }, 400);
          if (k === "sst_rate" && v > 1) return json({ error: "sst_rate_out_of_range" }, 400); // fraction 0..1
          if (k === "max_seats_per_booking") v = Math.max(1, Math.floor(v));
          if (k === "default_free_tickets" || k === "default_free_seats") v = Math.max(0, Math.floor(v));
          rows.push({ key: k, value: String(v), updated_at: nowIso });
        }
        if (rows.length) {
          const { error } = await sb.from("oe_settings").upsert(rows, { onConflict: "key" });
          if (error) throw error;
        }
        await logAudit(sb, admin, "oe_update_settings", p);
        return json({ ok: true });
      }

      // ── Switch Stripe mode (THE money switch — safeguards + audit) ───────
      // Safeguard 1 (server-enforced): switching to live requires the live
      // secret key to be configured. Safeguards 2 (typed confirm) + 3 (pending
      // warning / badge) are the UI's job; this always writes an audit row.
      case "setStripeMode": {
        const mode = body?.mode === "live" ? "live" : body?.mode === "sandbox" ? "sandbox" : null;
        if (!mode) return json({ error: "invalid_mode" }, 400);

        const { data: cur } = await sb.from("oe_settings").select("value").eq("key", "stripe_payment_mode").maybeSingle();
        const from = (cur?.value as string) ?? "sandbox";

        if (mode === "live" && !(Deno.env.get("OE_STRIPE_SECRET_KEY_LIVE") ?? "")) {
          return json({ error: "live_key_missing" }, 400);
        }

        const { error } = await sb
          .from("oe_settings")
          .upsert({ key: "stripe_payment_mode", value: mode, updated_at: new Date().toISOString() }, { onConflict: "key" });
        if (error) throw error;
        await logAudit(sb, admin, "oe_set_stripe_mode", { from, to: mode });
        return json({ ok: true, mode });
      }

      // ── Per-sub-account free-allowance overrides ─────────────────────────
      case "listSubaccountSettings": {
        const { data, error } = await sb
          .from("oe_subaccount_settings")
          .select("location_id, free_tickets, free_seats, updated_at")
          .order("updated_at", { ascending: false })
          .limit(1000);
        if (error) throw error;
        const rows = data ?? [];
        const ids = rows.map((r) => r.location_id as string);
        const nameMap: Record<string, string> = {};
        if (ids.length) {
          const { data: locs } = await sb.from("ghl_locations").select("location_id, business_name").in("location_id", ids);
          for (const l of locs ?? []) nameMap[l.location_id as string] = (l.business_name as string) ?? "";
        }
        return json({ rows: rows.map((r) => ({ ...r, business_name: nameMap[r.location_id as string] ?? null })) });
      }

      case "updateSubaccountSettings": {
        const locId = String(body?.locationId || "").trim();
        if (!locId) return json({ error: "location_required" }, 400);
        const ft = Math.max(0, Math.floor(Number(body?.free_tickets) || 0));
        const fs = Math.max(0, Math.floor(Number(body?.free_seats) || 0));
        const { error } = await sb
          .from("oe_subaccount_settings")
          .upsert({ location_id: locId, free_tickets: ft, free_seats: fs, updated_at: new Date().toISOString() }, { onConflict: "location_id" });
        if (error) throw error;
        await logAudit(sb, admin, "oe_update_subaccount", { location_id: locId, free_tickets: ft, free_seats: fs }, locId);
        return json({ ok: true });
      }

      // ═══ P7d — Permanent delete (test-data cleanup / purge junk) ═══════════

      // ── Hard-delete a booking (PERMANENT; frees its seats) ───────────────
      case "deleteBookingHard": {
        const code = String(body?.bookingId || "").trim();
        if (!code) return json({ error: "booking_required" }, 400);
        const { data: b } = await sb.from("oe_bookings").select("id, ghl_location_id").eq("booking_id", code).maybeSingle();
        if (!b) return json({ error: "not_found" }, 404);
        // booked_seats cascade-delete via FK; delete explicitly so seats free at once.
        await sb.from("oe_booked_seats").delete().eq("booking_id", b.id);
        const { error } = await sb.from("oe_bookings").delete().eq("id", b.id);
        if (error) throw error;
        await logAudit(sb, admin, "oe_delete_booking_hard", { booking_id: code }, b.ghl_location_id);
        return json({ ok: true });
      }

      // ── Delete a sub-account's free-allowance override row (PERMANENT) ───
      case "deleteSubaccountSettings": {
        const locId = String(body?.locationId || "").trim();
        if (!locId) return json({ error: "location_required" }, 400);
        const { error } = await sb.from("oe_subaccount_settings").delete().eq("location_id", locId);
        if (error) throw error;
        await logAudit(sb, admin, "oe_delete_subaccount", { location_id: locId }, locId);
        return json({ ok: true });
      }

      default:
        return json({ error: `Unknown action: ${action || "(none)"}` }, 400);
    }
  } catch (e) {
    console.error("offline-event-admin fn error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
