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

      default:
        return json({ error: `Unknown action: ${action || "(none)"}` }, 400);
    }
  } catch (e) {
    console.error("offline-event-admin fn error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
