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
import { hasOfflineEventAccess } from "../_shared/access.ts";
import { resolveOeStripe } from "../_shared/stripe.ts";
import { logToolUsage } from "../_shared/usage.ts";
import { checkRateLimit, emailKey, HOUR_MS } from "../_shared/ratelimit.ts";
// deno-lint-ignore no-explicit-any
type SB = any;

const TOOL_KEY = "offline_event";

// ── Booking abuse limit (pre-launch) ──────────────────────────────────────
// Unlike the AI endpoints there is no per-call cost here; this bounds junk seat
// holds and Stripe session churn. Damage is already bounded by finite seat
// inventory, the atomic seat claim and the stale-pending sweep, so the cap is
// deliberately generous.
//
// TWO dimensions, because neither alone is enough:
//  1. PER BOOKER (hashed email) — the primary limit. One sub-account hosts an
//     event that MANY different customers book, so a per-location cap alone
//     would throttle real attendees the moment an event opens. A single person
//     never legitimately submits 30 bookings in an hour.
//  2. PER LOCATION — the backstop. On its own, limit (1) is trivially bypassed
//     by rotating the email address, which is exactly how someone would flood an
//     event with junk holds. A real event can't exceed this (the venue seats
//     ~91), so it only ever catches a script.
const BOOKING_LIMITS = [{ windowMs: HOUR_MS, max: 30, label: "hour" }];
const BOOKING_LOCATION_LIMITS = [{ windowMs: HOUR_MS, max: 300, label: "hour" }];

/** Check + record one booking attempt. Returns true when EITHER dimension is
 *  over its cap (nothing has been written or charged at that point). */
async function bookingThrottled(sb: SB, locationId: string, email: string, kind: string): Promise<boolean> {
  const key = await emailKey(email);
  const rl = await checkRateLimit(sb, {
    toolKey: TOOL_KEY,
    clientKey: key,
    windows: BOOKING_LIMITS,
    eventType: "booking_attempt",
  });
  if (!rl.allowed) return true;
  // Backstop: counted by location_id on the same usage rows, so rotating the
  // email doesn't reset it.
  const locRl = await checkRateLimit(sb, {
    toolKey: TOOL_KEY,
    locationId,
    windows: BOOKING_LOCATION_LIMITS,
    eventType: "booking_attempt",
  });
  if (!locRl.allowed) return true;
  await logToolUsage(sb, {
    tool_key: TOOL_KEY,
    event_type: "booking_attempt",
    location_id: locationId,
    client_key: key, // hashed email — never the address itself
    meta: { kind },
  });
  return false;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Short, human-scannable booking code. */
function genBookingId(): string {
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BK-${ts}-${rand}`;
}

type OeSettings = {
  maxSeats: number;
  lunchPrice: number;
  sstRate: number;
  defaultFreeTickets: number;
  defaultFreeSeats: number;
};
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
    // Global default allowance for a NEW sub-account (admin-configurable, P7c).
    defaultFreeTickets: Math.max(0, Math.floor(num("default_free_tickets", 1))),
    defaultFreeSeats: Math.max(0, Math.floor(num("default_free_seats", 2))),
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

// ── Release stale PENDING bookings (no-webhook seat cleanup) ────────────────
// Without a Stripe webhook, an unpaid checkout would hold its seats forever.
// Instead we sweep lazily: whenever someone views a seat map (by event) or
// starts a booking (by location), any pending booking older than the checkout
// window is reconciled. We VERIFY with Stripe before releasing — a stale
// pending that actually got PAID (customer closed the return page before it
// confirmed) is promoted to confirmed instead of cancelled. This doubles as a
// lightweight missed-order safety net; a real webhook can be added later.
const HOLD_STALE_MINUTES = 35; // > the ~32-min Stripe session expiry set below

// deno-lint-ignore no-explicit-any
async function sweepStalePending(sb: SB, filter: { eventId?: string; locationId?: string }): Promise<void> {
  const cutoff = new Date(Date.now() - HOLD_STALE_MINUTES * 60 * 1000).toISOString();
  let q = sb.from("oe_bookings").select("id, stripe_session_id").eq("status", "pending").lt("created_at", cutoff);
  if (filter.eventId) q = q.eq("event_id", filter.eventId);
  if (filter.locationId) q = q.eq("ghl_location_id", filter.locationId);
  const { data } = await q;
  const rows = data ?? [];
  if (!rows.length) return; // common case: nothing stale, zero Stripe calls

  // deno-lint-ignore no-explicit-any
  let stripe: any = null;
  for (const r of rows) {
    let paid = false;
    if (r.stripe_session_id) {
      try {
        if (!stripe) stripe = (await resolveOeStripe(sb)).stripe;
        const s = await stripe.checkout.sessions.retrieve(r.stripe_session_id);
        paid = s?.payment_status === "paid" || s?.status === "complete";
      } catch { /* unknown → treat as unpaid, release below */ }
    }
    if (paid) {
      await sb.from("oe_bookings")
        .update({ status: "confirmed", payment_note: "Reconciled (paid, late)", updated_at: new Date().toISOString() })
        .eq("id", r.id).eq("status", "pending");
    } else {
      // booked_seats cascade-delete with the row, but delete explicitly so seats
      // free immediately even though we keep the (cancelled) booking for history.
      await sb.from("oe_booked_seats").delete().eq("booking_id", r.id);
      await sb.from("oe_bookings")
        .update({ status: "cancelled", payment_note: "Payment not completed (auto-released)", updated_at: new Date().toISOString() })
        .eq("id", r.id).eq("status", "pending");
    }
  }
}

// ── Shared booking plan: validate + price a request SERVER-SIDE ─────────────
// Used by BOTH createBooking (free path) and createCheckout (paid path) so the
// two flows can NEVER price a seat differently. Everything the frontend sends is
// re-derived here from the DB (event price, free allowance, settings) — the
// client's numbers are display-only and are never trusted. Returns a priced plan
// or a typed error the caller maps to a JSON response. Does NOT touch the DB for
// writes and does NOT gate tool access (the caller does that first).
type BookingPlan = {
  ok: true;
  event: { id: string; display_label: string; price_per_seat: number };
  seatSelection: boolean;
  seatLabels: string[]; // real labels when seat-selection is on; [] for quantity-only (synthesized at insert)
  seatCount: number;
  lunchQty: number;
  freeUsedNow: number;
  paidSeats: number;
  pricePerSeat: number;
  lunchPrice: number;
  sstRate: number;
  subtotal: number;
  sst: number;
  total: number;
};
type PlanError = { ok: false; error: string; status: number; extra?: Record<string, unknown> };

// deno-lint-ignore no-explicit-any
async function computeBookingPlan(sb: SB, locationId: string, body: any): Promise<BookingPlan | PlanError> {
  const eventId = String(body?.event_id || "").trim();
  const email = String(body?.email || "").trim();
  const lunchQty = Math.max(0, Math.floor(Number(body?.lunch_qty) || 0));
  const seatsInput: string[] = Array.isArray(body?.seats)
    ? body.seats.map((s: unknown) => String(s).trim()).filter(Boolean)
    : [];
  const quantity = Math.max(0, Math.floor(Number(body?.quantity) || 0));

  if (!eventId) return { ok: false, error: "event_id required", status: 400 };
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "email_required", status: 400 };

  const { data: event, error: evErr } = await sb
    .from("oe_events")
    .select("id, display_label, status, price_per_seat, seat_selection_enabled")
    .eq("id", eventId)
    .maybeSingle();
  if (evErr) throw evErr;
  if (!event) return { ok: false, error: "event_not_found", status: 404 };
  if (event.status !== "live") return { ok: false, error: "event_not_bookable", status: 400 };

  const s = await loadSettings(sb);
  const seatSelection = event.seat_selection_enabled !== false;

  let seatLabels: string[];
  let seatCount: number;
  if (seatSelection) {
    seatLabels = [...new Set(seatsInput)];
    seatCount = seatLabels.length;
    if (seatCount < 1) return { ok: false, error: "no_seats_selected", status: 400 };
  } else {
    seatCount = quantity;
    if (seatCount < 1) return { ok: false, error: "no_quantity", status: 400 };
    seatLabels = []; // synthesized by the caller (needs the booking code)
  }
  if (seatCount > s.maxSeats) return { ok: false, error: "too_many_seats", status: 400, extra: { max: s.maxSeats } };

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

  return {
    ok: true,
    event: { id: event.id, display_label: event.display_label, price_per_seat: price },
    seatSelection,
    seatLabels,
    seatCount,
    lunchQty,
    freeUsedNow,
    paidSeats,
    pricePerSeat: price,
    lunchPrice: s.lunchPrice,
    sstRate: s.sstRate,
    subtotal,
    sst,
    total,
  };
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
        // Auto-register a new sub-account with the ADMIN-CONFIGURED global default
        // allowance (P7c). ignoreDuplicates → existing rows (incl. per-sub-account
        // overrides) are never overwritten.
        const s = await loadSettings(sb);
        await sb
          .from("oe_subaccount_settings")
          .upsert(
            { location_id: locationId, free_tickets: s.defaultFreeTickets, free_seats: s.defaultFreeSeats },
            { onConflict: "location_id", ignoreDuplicates: true },
          );

        const enabled = await hasOfflineEventAccess(sb, locationId, req);
        if (!enabled) return json({ context: { enabled: false } });

        const { data: settingsRow } = await sb
          .from("oe_subaccount_settings")
          .select("free_tickets, free_seats")
          .eq("location_id", locationId)
          .maybeSingle();
        const freeTickets = Number(settingsRow?.free_tickets ?? s.defaultFreeTickets);
        const freeSeats = Number(settingsRow?.free_seats ?? s.defaultFreeSeats);
        const freeSeatsUsed = await freeSeatsUsedFor(sb, locationId);

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
        if (!(await hasOfflineEventAccess(sb, locationId, req))) return json({ error: "tool_disabled" }, 403);

        const { data: events, error } = await sb
          .from("oe_events")
          .select(
            // title_*/start_time/end_time added for the customer card: it renders
            // the real name, a generated date range and a formatted time. Field
            // list only — no query or write behaviour changed here.
            "id, display_label, title_zh, title_en, start_date, end_date, start_time, end_time, time_slot, status, price_per_seat, capacity, theme_zh, theme_en, notice_zh, notice_en, floor_plan_id, seat_selection_enabled, sort_order",
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
        if (!(await hasOfflineEventAccess(sb, locationId, req))) return json({ error: "tool_disabled" }, 403);
        const eventId = String(body?.event_id || "").trim();
        if (!eventId) return json({ error: "event_id required" }, 400);
        // Release any stale unpaid holds on this event so the seat map is fresh.
        await sweepStalePending(sb, { eventId });

        const { data: event, error } = await sb
          .from("oe_events")
          .select(
            // Same additive field list as listEvents (see the note there).
            "id, display_label, title_zh, title_en, start_date, end_date, start_time, end_time, time_slot, status, price_per_seat, capacity, theme_zh, theme_en, notice_zh, notice_en, floor_plan_id, seat_selection_enabled",
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
        if (!(await hasOfflineEventAccess(sb, locationId, req))) return json({ error: "tool_disabled" }, 403);
        // Reconcile this location's stale unpaid holds first (frees seats + free allowance).
        await sweepStalePending(sb, { locationId });

        const plan = await computeBookingPlan(sb, locationId, body);
        if (!plan.ok) return json({ error: plan.error, ...(plan.extra ?? {}) }, plan.status);

        const email = String(body?.email || "").trim();
        const phone = String(body?.phone || "").trim();

        // Paid → the client must go through createCheckout (Stripe). Return the
        // authoritative breakdown; write NOTHING here.
        if (plan.total > 0) {
          return json({
            requiresPayment: true,
            breakdown: {
              seatCount: plan.seatCount, freeUsedNow: plan.freeUsedNow, paidSeats: plan.paidSeats,
              pricePerSeat: plan.pricePerSeat, lunchQty: plan.lunchQty, lunchPrice: plan.lunchPrice,
              subtotal: plan.subtotal, sst: plan.sst, total: plan.total,
            },
          });
        }

        // Throttle only the path that actually writes state. The paid branch
        // above just returns a price breakdown, so it isn't counted.
        if (await bookingThrottled(sb, locationId, email, "free")) {
          return json({ error: "rate_limited" }, 429);
        }

        // FREE booking — create (confirmed) then atomically claim.
        const bookingId = genBookingId();
        const seatLabels = plan.seatSelection
          ? plan.seatLabels
          : Array.from({ length: plan.seatCount }, (_, i) => `#${bookingId}-${i + 1}`);
        const qrPayload = JSON.stringify({
          v: 1, bookingId, email, phone, eventId: plan.event.id, eventLabel: plan.event.display_label, totalSeats: plan.seatCount,
        });

        const { data: inserted, error: insErr } = await sb
          .from("oe_bookings")
          .insert({
            booking_id: bookingId,
            event_id: plan.event.id,
            event_label: plan.event.display_label,
            email,
            phone,
            free_seats: seatLabels, // fully-free booking → all seats are free
            addon_seats: [],
            lunch_qty: plan.lunchQty,
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
          p_event_id: plan.event.id,
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
            event_label: plan.event.display_label,
            email,
            total: 0,
            free_used: plan.freeUsedNow,
          },
        });
      }

      // ── Create a Stripe Checkout session for a PAID booking (P5) ──────────
      // Money-safe ordering: (1) re-price server-side, (2) write a PENDING
      // booking, (3) atomically claim the seats — ALL before any Stripe call, so
      // a seat that was just taken is rejected with money untouched — then (4)
      // create the hosted Checkout session. Seats are HELD for the pending
      // booking; a 30-min expiry releases them via the checkout.session.expired
      // webhook. The webhook flips pending → confirmed on payment.
      case "createCheckout": {
        if (!(await hasOfflineEventAccess(sb, locationId, req))) return json({ error: "tool_disabled" }, 403);

        const origin = String(body?.origin || "").trim();
        if (!/^https?:\/\/[^\s/]+/.test(origin)) return json({ error: "origin_required" }, 400);
        // OPTIONAL flag: only added when the caller says it is inside the GHL
        // iframe (so checkout ran in a spawned tab that may close itself).
        // Absent → empty string → URLs byte-identical to before this change, so
        // Checkout sessions already in flight are unaffected by the deploy.
        const embedParam = body?.embed === true ? "&embed=1" : "";
        // Reconcile this location's stale unpaid holds first (frees seats + free allowance).
        await sweepStalePending(sb, { locationId });

        const plan = await computeBookingPlan(sb, locationId, body);
        if (!plan.ok) return json({ error: plan.error, ...(plan.extra ?? {}) }, plan.status);
        if (plan.total <= 0) return json({ error: "no_payment_required" }, 400);

        const email = String(body?.email || "").trim();
        const phone = String(body?.phone || "").trim();

        // Before creating a pending hold or a Stripe session.
        if (await bookingThrottled(sb, locationId, email, "checkout")) {
          return json({ error: "rate_limited" }, 429);
        }

        // 1) PENDING booking. Free portion → free_seats (counts against the free
        //    allowance while held); paid portion → addon_seats.
        const bookingId = genBookingId();
        const allLabels = plan.seatSelection
          ? plan.seatLabels
          : Array.from({ length: plan.seatCount }, (_, i) => `#${bookingId}-${i + 1}`);
        const freeLabels = allLabels.slice(0, plan.freeUsedNow);
        const paidLabels = allLabels.slice(plan.freeUsedNow);
        const qrPayload = JSON.stringify({
          v: 1, bookingId, email, phone, eventId: plan.event.id, eventLabel: plan.event.display_label, totalSeats: plan.seatCount,
        });

        const { data: inserted, error: insErr } = await sb
          .from("oe_bookings")
          .insert({
            booking_id: bookingId,
            event_id: plan.event.id,
            event_label: plan.event.display_label,
            email,
            phone,
            free_seats: freeLabels,
            addon_seats: paidLabels,
            lunch_qty: plan.lunchQty,
            subtotal: plan.subtotal,
            sst_amount: plan.sst,
            total: plan.total,
            status: "pending",
            qr_payload: qrPayload,
            ghl_location_id: locationId,
            created_by: "customer",
          })
          .select("id")
          .single();
        if (insErr) throw insErr;

        // 2) Atomic seat claim BEFORE any money moves. On failure the booking row
        //    is deleted (booked_seats cascade with it) → seats released.
        const { data: claimed, error: claimErr } = await sb.rpc("oe_claim_seats", {
          p_event_id: plan.event.id,
          p_booking_id: inserted.id,
          p_seats: allLabels,
        });
        if (claimErr) {
          await sb.from("oe_bookings").delete().eq("id", inserted.id);
          throw claimErr;
        }
        if (claimed !== true) {
          await sb.from("oe_bookings").delete().eq("id", inserted.id);
          return json({ error: "seats_unavailable" }, 409);
        }

        // 3) Hosted Stripe Checkout session. Two line items so the receipt shows
        //    the SST breakdown. metadata.bookingId lets the webhook find this row.
        try {
          const { stripe } = await resolveOeStripe(sb);
          const subtotalCents = Math.round(plan.subtotal * 100);
          const sstCents = Math.round(plan.sst * 100);
          // deno-lint-ignore no-explicit-any
          const lineItems: any[] = [
            {
              price_data: {
                currency: "myr",
                product_data: { name: `${plan.event.display_label} — ${plan.seatCount} seat(s)` },
                unit_amount: subtotalCents,
              },
              quantity: 1,
            },
          ];
          if (sstCents > 0) {
            lineItems.push({
              price_data: { currency: "myr", product_data: { name: "SST (8%)" }, unit_amount: sstCents },
              quantity: 1,
            });
          }

          const HOLD_SECONDS = 30 * 60; // seats held ~30 min during checkout
          const session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: lineItems,
            customer_email: email || undefined,
            metadata: { bookingId: inserted.id, bookingCode: bookingId, locationId },
            // location_id travels in the URL on purpose. When the Playbook runs
            // inside the GHL iframe, Stripe (X-Frame-Options: DENY) can't be
            // framed, so checkout opens in a NEW TAB — and sessionStorage, where
            // the return page used to read the location from, is per-tab and
            // therefore EMPTY there. Without this the customer pays and the
            // return page can't confirm the booking, so no ticket ever appears.
            success_url:
              `${origin}/checkout/return?booking=${encodeURIComponent(bookingId)}` +
              `&session={CHECKOUT_SESSION_ID}&location_id=${encodeURIComponent(locationId)}${embedParam}`,
            // Same reason: a cancel must land on the customer's OWN events page,
            // not a location-less one that shows the "open from QAI" gate.
            cancel_url: `${origin}/events?location_id=${encodeURIComponent(locationId)}&checkout=cancelled${embedParam}`,
            expires_at: Math.floor(Date.now() / 1000) + HOLD_SECONDS + 120,
          });

          await sb.from("oe_bookings").update({ stripe_session_id: session.id }).eq("id", inserted.id);

          return json({ ok: true, checkoutUrl: session.url, bookingCode: bookingId });
        } catch (e) {
          // Checkout creation failed — release the held seats + pending booking
          // (booked_seats cascade-delete with the row) so nothing is stranded.
          await sb.from("oe_bookings").delete().eq("id", inserted.id);
          console.error("createCheckout stripe error:", e);
          return json({ error: "checkout_failed" }, 502);
        }
      }

      // ── Poll one booking's status (for the /checkout/return page) ─────────
      // Scoped to the caller's OWN location. Always 200 (status field) so the
      // return page can poll cleanly while the webhook lands.
      case "getBooking": {
        const code = String(body?.booking_code || body?.booking || "").trim();
        if (!code) return json({ status: "not_found" });
        const { data: b } = await sb
          .from("oe_bookings")
          .select("booking_id, status, qr_payload, free_seats, addon_seats, event_label, email, total")
          .eq("booking_id", code)
          .eq("ghl_location_id", locationId)
          .maybeSingle();
        if (!b) return json({ status: "not_found" });
        const seats = [...(b.free_seats ?? []), ...(b.addon_seats ?? [])];
        return json({
          status: b.status,
          booking: {
            booking_id: b.booking_id,
            qr_payload: b.qr_payload,
            seats,
            event_label: b.event_label,
            email: b.email,
            total: Number(b.total ?? 0),
            free_used: (b.free_seats ?? []).length,
          },
        });
      }

      // ── Confirm a paid booking by VERIFYING with Stripe (no webhook) ──────
      // Called by /checkout/return. The browser's word is NEVER trusted: we
      // retrieve the Checkout session with the secret key and only confirm if
      // Stripe itself says it's paid. Idempotent (guarded on status=pending);
      // seats were already held at checkout, so nothing is re-claimed here.
      case "confirmBooking": {
        if (!(await hasOfflineEventAccess(sb, locationId, req))) return json({ error: "tool_disabled" }, 403);
        const sessionId = String(body?.session_id || body?.session || "").trim();
        const code = String(body?.booking_code || body?.booking || "").trim();
        if (!sessionId && !code) return json({ error: "missing_reference" }, 400);

        // Find the booking, scoped to THIS location.
        let bq = sb
          .from("oe_bookings")
          .select("id, booking_id, status, stripe_session_id, qr_payload, free_seats, addon_seats, event_label, email, total")
          .eq("ghl_location_id", locationId);
        bq = sessionId ? bq.eq("stripe_session_id", sessionId) : bq.eq("booking_id", code);
        const { data: b } = await bq.maybeSingle();
        if (!b) return json({ status: "not_found" });

        const bookingOut = () => ({
          booking_id: b.booking_id,
          qr_payload: b.qr_payload,
          seats: [...(b.free_seats ?? []), ...(b.addon_seats ?? [])],
          event_label: b.event_label,
          email: b.email,
          total: Number(b.total ?? 0),
          free_used: (b.free_seats ?? []).length,
        });

        if (b.status === "confirmed") return json({ status: "confirmed", booking: bookingOut() });
        if (b.status === "cancelled") return json({ status: "cancelled" });

        // pending → verify against Stripe with the secret key.
        const sid = b.stripe_session_id || sessionId;
        if (!sid) return json({ status: "pending" });
        const { stripe } = await resolveOeStripe(sb);
        // deno-lint-ignore no-explicit-any
        let session: any;
        try {
          session = await stripe.checkout.sessions.retrieve(sid);
        } catch (e) {
          console.error("confirmBooking retrieve error:", e);
          return json({ status: "pending" }); // transient — let the page keep polling
        }
        // Defense: the session must belong to this booking.
        if (session?.metadata?.bookingId && session.metadata.bookingId !== b.id) {
          return json({ status: "not_found" });
        }
        const paid = session?.payment_status === "paid" || session?.status === "complete";
        if (!paid) return json({ status: "pending" });

        // Paid → confirm ONCE (guard on pending = idempotent). Best-effort receipt.
        const paymentIntentId =
          typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
        let receiptUrl: string | null = null;
        try {
          if (paymentIntentId) {
            const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
            const charge = pi?.latest_charge;
            receiptUrl = charge && typeof charge === "object" ? (charge.receipt_url ?? null) : null;
          }
        } catch { /* receipt is optional */ }
        const amount = session.amount_total != null ? (Number(session.amount_total) / 100).toFixed(2) : "";
        const currency = String(session.currency || "").toUpperCase();

        await sb
          .from("oe_bookings")
          .update({
            status: "confirmed",
            payment_intent_id: paymentIntentId ?? null,
            receipt_url: receiptUrl,
            payment_note: `Stripe ${amount} ${currency}`.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", b.id)
          .eq("status", "pending");

        return json({ status: "confirmed", booking: bookingOut() });
      }

      // ── "My bookings": all confirmed tickets for THIS location (team view) ─
      // A location = one team/company; colleagues who book for each other should
      // all see "our tickets", so this lists EVERY confirmed booking under the
      // caller's location_id — no email needed. Scoping is still enforced
      // SERVER-SIDE by ghl_location_id, so one location NEVER sees another's
      // tickets. Only `confirmed` rows (real tickets) are returned;
      // pending/cancelled are hidden. Each row carries its booker email so the
      // team can tell whose ticket is whose.
      case "listMyBookings": {
        if (!(await hasOfflineEventAccess(sb, locationId, req))) return json({ error: "tool_disabled" }, 403);

        const { data, error } = await sb
          .from("oe_bookings")
          .select(
            // event_label stays as-is — it is the SNAPSHOT taken at booking time
            // and changing its source is batch 3b. The embedded oe_events fields
            // grow by title_*/start_time/end_time so the ticket can show the
            // event's current name and a formatted time.
            "booking_id, email, event_label, free_seats, addon_seats, lunch_qty, total, qr_payload, created_at, oe_events(title_zh, title_en, start_date, end_date, start_time, end_time, time_slot, theme_zh, theme_en)",
          )
          .eq("ghl_location_id", locationId)
          .eq("status", "confirmed")
          .order("created_at", { ascending: false });
        if (error) throw error;

        // deno-lint-ignore no-explicit-any
        const bookings = (data ?? []).map((b: any) => {
          const ev = b.oe_events ?? null;
          return {
            booking_id: b.booking_id,
            email: b.email ?? "",
            event_label: b.event_label,
            start_date: ev?.start_date ?? null,
            end_date: ev?.end_date ?? null,
            time_slot: ev?.time_slot ?? null,
            theme_zh: ev?.theme_zh ?? null,
            theme_en: ev?.theme_en ?? null,
            seats: [...(b.free_seats ?? []), ...(b.addon_seats ?? [])],
            lunch_qty: Number(b.lunch_qty ?? 0),
            total: Number(b.total ?? 0),
            qr_payload: b.qr_payload,
          };
        });
        // Latest event date first (nulls sink to the bottom).
        bookings.sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""));
        return json({ bookings });
      }

      default:
        return json({ error: `Unknown action: ${action || "(none)"}` }, 400);
    }
  } catch (e) {
    console.error("oe fn error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
