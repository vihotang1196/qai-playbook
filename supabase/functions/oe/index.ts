// ════════════════════════════════════════════════════════════════════════
// Offline Event — CUSTOMER-scoped edge function (`oe`).
//
// The customer booking page (/events) never touches the RLS-locked oe_ tables
// directly; it calls this function with the anon key (verify_jwt off) and every
// action is scoped by the caller's own GHL `location_id`. Runs with the service
// role internally. Mirrors the Review Boost `rb` function's shape + security.
//
// Identity = trust-the-URL location_id (weak, same as RB / Helpdesk). Access is
// gated by location_tool_access(offline_event) (default-allow) — the Admin Portal
// toggle. Reads: resolveContext / listEvents / getEvent (P3). Write:
// createBooking (P4) — FREE bookings only complete here; the atomic seat claim
// (oe_claim_seats + UNIQUE(event_id,seat_label)) makes same-seat double-booking
// impossible. Paid bookings return { requiresPayment } and are completed in P5.
// ════════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, serviceClient } from "../_shared/ghl.ts";
import { hasToolAccess } from "../_shared/access.ts";
// deno-lint-ignore no-explicit-any
type SB = any;

const TOOL_KEY = "offline_event";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Short, human-scannable booking code. */
function genBookingId(): string {
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BK-${ts}-${rand}`;
}

type OeSettings = { maxSeats: number; lunchPrice: number; sstRate: number };
async function loadSettings(sb: SB): Promise<OeSettings> {
  const { data } = await sb.from("oe_settings").select("key, value");
  const m: Record<string, string> = {};
  for (const r of data ?? []) m[r.key as string] = r.value as string;
  const num = (k: string, d: number) => {
    const v = Number(m[k]);
    return Number.isFinite(v) ? v : d;
  };
  return {
    maxSeats: Math.max(1, Math.floor(num("max_seats_per_booking", 4))),
    lunchPrice: num("lunch_price", 39.99),
    sstRate: num("sst_rate", 0.08),
  };
}

/** Free seats already redeemed by this sub-account (active bookings only). */
async function freeSeatsUsedFor(sb: SB, locationId: string): Promise<number> {
  const { data } = await sb
    .from("oe_bookings")
    .select("free_seats")
    .eq("ghl_location_id", locationId)
    .neq("status", "cancelled")
    .eq("is_archived", false);
  return (data ?? []).reduce(
    (n: number, r: { free_seats: string[] | null }) => n + (Array.isArray(r.free_seats) ? r.free_seats.length : 0),
    0,
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const locationId = String(body?.location_id || body?.locationId || "").trim();
    const sb = serviceClient();

    if (!locationId) return json({ error: "location_required" }, 400);

    switch (action) {
      // ── Resolve context (identity + tool access + free allowance + settings) ──
      case "resolveContext": {
        await sb
          .from("oe_subaccount_settings")
          .upsert(
            { location_id: locationId, free_tickets: 1, free_seats: 2 },
            { onConflict: "location_id", ignoreDuplicates: true },
          );

        const enabled = await hasToolAccess(sb, locationId, TOOL_KEY);
        if (!enabled) return json({ context: { enabled: false } });

        const { data: settingsRow } = await sb
          .from("oe_subaccount_settings")
          .select("free_tickets, free_seats")
          .eq("location_id", locationId)
          .maybeSingle();
        const freeTickets = Number(settingsRow?.free_tickets ?? 1);
        const freeSeats = Number(settingsRow?.free_seats ?? 2);
        const freeSeatsUsed = await freeSeatsUsedFor(sb, locationId);

        const s = await loadSettings(sb);

        let businessName: string | null = null;
        try {
          const { data: loc } = await sb
            .from("ghl_locations")
            .select("business_name")
            .eq("location_id", locationId)
            .maybeSingle();
          businessName = (loc?.business_name as string) ?? null;
        } catch { /* best-effort */ }

        return json({
          context: {
            enabled: true,
            businessName,
            freeTickets,
            freeSeats,
            freeSeatsUsed,
            freeSeatsRemaining: Math.max(0, freeSeats - freeSeatsUsed),
            settings: { maxSeats: s.maxSeats, lunchPrice: s.lunchPrice, sstRate: s.sstRate },
          },
        });
      }

      // ── List bookable events (live) + display-only ──────────────────────
      case "listEvents": {
        if (!(await hasToolAccess(sb, locationId, TOOL_KEY))) return json({ error: "tool_disabled" }, 403);

        const { data: events, error } = await sb
          .from("oe_events")
          .select(
            "id, display_label, start_date, end_date, time_slot, status, price_per_seat, capacity, theme_zh, theme_en, notice_zh, notice_en, floor_plan_id, seat_selection_enabled, sort_order",
          )
          .in("status", ["live", "display"])
          .order("sort_order", { ascending: true })
          .order("start_date", { ascending: true });
        if (error) throw error;
        const list = events ?? [];

        const planIds = [...new Set(list.map((e) => e.floor_plan_id).filter(Boolean))] as string[];
        const planSeats: Record<string, number> = {};
        if (planIds.length) {
          const { data: plans } = await sb.from("oe_floor_plans").select("id, physical_seats").in("id", planIds);
          for (const p of plans ?? []) planSeats[p.id as string] = Number(p.physical_seats ?? 0);
        }

        const ids = list.map((e) => e.id as string);
        const bookedByEvent: Record<string, number> = {};
        if (ids.length) {
          const { data: seats } = await sb.from("oe_booked_seats").select("event_id").in("event_id", ids);
          for (const s of seats ?? []) bookedByEvent[s.event_id as string] = (bookedByEvent[s.event_id as string] || 0) + 1;
        }

        const events_out = list.map((e) => {
          const cap = e.capacity != null ? Number(e.capacity) : (e.floor_plan_id ? planSeats[e.floor_plan_id as string] ?? 0 : 0);
          const booked = bookedByEvent[e.id as string] || 0;
          return { ...e, capacity_effective: cap, booked_seats: booked, seats_left: cap > 0 ? Math.max(0, cap - booked) : null };
        });
        return json({ events: events_out });
      }

      // ── One event + its floor plan + already-claimed seat labels ────────
      case "getEvent": {
        if (!(await hasToolAccess(sb, locationId, TOOL_KEY))) return json({ error: "tool_disabled" }, 403);
        const eventId = String(body?.event_id || "").trim();
        if (!eventId) return json({ error: "event_id required" }, 400);

        const { data: event, error } = await sb
          .from("oe_events")
          .select(
            "id, display_label, start_date, end_date, time_slot, status, price_per_seat, capacity, theme_zh, theme_en, notice_zh, notice_en, floor_plan_id, seat_selection_enabled",
          )
          .eq("id", eventId)
          .in("status", ["live", "display"])
          .maybeSingle();
        if (error) throw error;
        if (!event) return json({ error: "event_not_found" }, 404);

        let floorPlan: { id: string; layout_data: unknown; physical_seats: number } | null = null;
        if (event.floor_plan_id) {
          const { data: fp } = await sb
            .from("oe_floor_plans")
            .select("id, layout_data, physical_seats")
            .eq("id", event.floor_plan_id)
            .maybeSingle();
          if (fp) floorPlan = { id: fp.id as string, layout_data: fp.layout_data, physical_seats: Number(fp.physical_seats ?? 0) };
        }

        const { data: claimed } = await sb.from("oe_booked_seats").select("seat_label").eq("event_id", eventId);
        const bookedSeats = (claimed ?? []).map((r) => r.seat_label as string);

        return json({ event, floorPlan, bookedSeats });
      }

      // ── Create a booking (P4: FREE only completes here; paid → P5) ──────
      // Everything is validated + priced SERVER-SIDE. The seat claim is atomic:
      // oe_claim_seats inserts all seats in one statement; a UNIQUE collision or
      // capacity overflow aborts it → the just-created booking row is rolled back.
      case "createBooking": {
        if (!(await hasToolAccess(sb, locationId, TOOL_KEY))) return json({ error: "tool_disabled" }, 403);

        const eventId = String(body?.event_id || "").trim();
        const email = String(body?.email || "").trim();
        const phone = String(body?.phone || "").trim();
        const lunchQty = Math.max(0, Math.floor(Number(body?.lunch_qty) || 0));
        const seatsInput: string[] = Array.isArray(body?.seats) ? body.seats.map((s: unknown) => String(s).trim()).filter(Boolean) : [];
        const quantity = Math.max(0, Math.floor(Number(body?.quantity) || 0));

        if (!eventId) return json({ error: "event_id required" }, 400);
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "email_required" }, 400);

        const { data: event, error: evErr } = await sb
          .from("oe_events")
          .select("id, display_label, status, price_per_seat, seat_selection_enabled")
          .eq("id", eventId)
          .maybeSingle();
        if (evErr) throw evErr;
        if (!event) return json({ error: "event_not_found" }, 404);
        if (event.status !== "live") return json({ error: "event_not_bookable" }, 400);

        const s = await loadSettings(sb);
        const seatSelection = event.seat_selection_enabled !== false;

        // Seat labels + count.
        let seatLabels: string[];
        let seatCount: number;
        if (seatSelection) {
          seatLabels = [...new Set(seatsInput)];
          seatCount = seatLabels.length;
          if (seatCount < 1) return json({ error: "no_seats_selected" }, 400);
        } else {
          seatCount = quantity;
          if (seatCount < 1) return json({ error: "no_quantity" }, 400);
          seatLabels = []; // synthesized below (needs the booking code)
        }
        if (seatCount > s.maxSeats) return json({ error: "too_many_seats", max: s.maxSeats }, 400);

        // Free-ticket accounting (server-side; per location).
        const freeUsedAlready = await freeSeatsUsedFor(sb, locationId);
        const { data: sa } = await sb
          .from("oe_subaccount_settings")
          .select("free_seats")
          .eq("location_id", locationId)
          .maybeSingle();
        const freeAllot = Number(sa?.free_seats ?? 2);
        const freeRemaining = Math.max(0, freeAllot - freeUsedAlready);
        const freeUsedNow = Math.min(seatCount, freeRemaining);
        const paidSeats = seatCount - freeUsedNow;

        const price = Number(event.price_per_seat ?? 0);
        const subtotal = round2(paidSeats * price + lunchQty * s.lunchPrice);
        const sst = subtotal > 0 ? round2(subtotal * s.sstRate) : 0;
        const total = round2(subtotal + sst);

        // Paid → P5 handles Stripe; do NOT create a booking in P4.
        if (total > 0) {
          return json({
            requiresPayment: true,
            breakdown: { seatCount, freeUsedNow, paidSeats, pricePerSeat: price, lunchQty, lunchPrice: s.lunchPrice, subtotal, sst, total },
          });
        }

        // FREE booking — create then atomically claim.
        const bookingId = genBookingId();
        if (!seatSelection) seatLabels = Array.from({ length: seatCount }, (_, i) => `#${bookingId}-${i + 1}`);
        const qrPayload = JSON.stringify({
          v: 1, bookingId, email, phone, eventId, eventLabel: event.display_label, totalSeats: seatCount,
        });

        const { data: inserted, error: insErr } = await sb
          .from("oe_bookings")
          .insert({
            booking_id: bookingId,
            event_id: eventId,
            event_label: event.display_label,
            email,
            phone,
            free_seats: seatLabels, // fully-free booking → all seats are free
            addon_seats: [],
            lunch_qty: lunchQty,
            subtotal: 0,
            sst_amount: 0,
            total: 0,
            status: "confirmed",
            qr_payload: qrPayload,
            ghl_location_id: locationId,
            created_by: "customer",
          })
          .select("id")
          .single();
        if (insErr) throw insErr;

        const { data: claimed, error: claimErr } = await sb.rpc("oe_claim_seats", {
          p_event_id: eventId,
          p_booking_id: inserted.id,
          p_seats: seatLabels,
        });
        if (claimErr) {
          await sb.from("oe_bookings").delete().eq("id", inserted.id);
          throw claimErr;
        }
        if (claimed !== true) {
          // Seat collision or capacity overflow — roll back the whole booking.
          await sb.from("oe_bookings").delete().eq("id", inserted.id);
          return json({ error: "seats_unavailable" }, 409);
        }

        return json({
          ok: true,
          booking: {
            booking_id: bookingId,
            qr_payload: qrPayload,
            seats: seatLabels,
            event_label: event.display_label,
            email,
            total: 0,
            free_used: freeUsedNow,
          },
        });
      }

      default:
        return json({ error: `Unknown action: ${action || "(none)"}` }, 400);
    }
  } catch (e) {
    console.error("oe fn error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
