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

/**
 * SNAPSHOT FIELD — the event's name at the moment of booking. Changing this
 * logic makes new tickets inconsistent with historical ones. The display_label
 * fallback exists because that column is NOT NULL, which guarantees a ticket can
 * never be printed with a blank name. (Today the two hold the same text:
 * display_label is written only as a shadow of title_zh.)
 *
 * Safe to change because nothing keys off it: check-in resolves a ticket by
 * booking_id and compares event_id UUIDs, never this string.
 */
function snapshotEventName(ev: { title_zh?: string | null; display_label?: string | null }): string {
  return (ev?.title_zh ?? "").trim() || String(ev?.display_label ?? "");
}

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
    //
    // BOTH KEYS DO EXIST in oe_settings, each `"1"`, written 2026-07-28 04:11:29 by
    // the allowance reset — verified directly against the database 2026-07-29.
    // (An earlier pass through this file claimed they were absent, off a Table
    // Editor reading; the SQL says otherwise. The stored value wins and these
    // fallbacks do NOT currently decide anything.)
    //
    // So these are what happens only if a row is ever deleted or renamed. They
    // still matter: the seven fallbacks for these two keys used to read 1, 2, 2,
    // "1", "2", 1, 1 — five different opinions about the same two numbers, which
    // is a trap that springs the day a row goes missing. Now all zero, because the
    // right answer to "no configuration" is "give nothing": a sub-account that
    // should get free seats is one oe_subaccount_settings row away and that row
    // records the decision.
    //
    // ⚠️ Changing these does NOT change what new sub-accounts inherit today —
    // that is the stored `1`. Only editing oe_settings does.
    defaultFreeTickets: Math.max(0, Math.floor(num("default_free_tickets", 0))),
    defaultFreeSeats: Math.max(0, Math.floor(num("default_free_seats", 0))),
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
// Without a Stripe webhook, an unpaid checkout would hold its seats forever. So
// any pending booking older than HOLD_STALE_MINUTES gets reconciled, both lazily
// (someone views a seat map / starts a booking) and on a schedule (batch 6's cron
// calls `sweepAll`, so an event nobody is browsing still frees its seats).
//
// ORDER MATTERS — retrieve, then expire, then release (batch 6):
//   1. RETRIEVE the session and look at payment_status. Paid → promote to
//      confirmed and touch nothing else. This doubles as the missed-order safety
//      net (customer closed the return page before it confirmed).
//   2. Not paid → EXPIRE the session first. Seats are held 10 minutes but Stripe
//      refuses an `expires_at` under 30 minutes, so for ~20 minutes a session we
//      have given up on is still payable. Releasing the seats before killing the
//      session is how "seats resold, then the original customer pays" happens.
//   3. Only once the session is provably dead do we free the seats.
//
// ANY Stripe call that fails means we SKIP this booking and leave it pending for
// the next round. Treating an unreachable Stripe as "unpaid" (what this used to
// do) means a blip releases the seats of a booking that was actually paid — and
// at a 10-minute window with a 2-minute cron, blips get many chances.
const HOLD_STALE_MINUTES = 10;
// Per round. Each row costs 1–2 sequential Stripe calls and edge functions die at
// 150s, so a backlog must be drained over several rounds rather than one long one.
const SWEEP_LIMIT = 50;

export type SweepResult = { scanned: number; confirmed: number; released: number; skipped: number };

// ── sweepAll's shared secret + overlap lock (batch 6) ───────────────────────

/** Constant-time compare, so a wrong secret can't be narrowed down byte by byte.
 *  Length is compared up front and therefore leaks — over HTTP that is noise, and
 *  the alternative (padding) buys nothing real. */
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const SWEEP_LOCK_KEY = "sweep_lock";
// Longer than any plausible round (50 rows × ~2 Stripe calls) so a live run is
// never stolen, short enough that a CRASHED run unblocks itself without anyone
// noticing there was a lock at all.
const SWEEP_LOCK_TTL_MS = 5 * 60 * 1000;

/**
 * One-row optimistic lock in `oe_settings`. Postgres advisory locks are NOT usable
 * here: they are session-scoped, and these queries go through the pooler where the
 * next statement may land on a different connection — the lock would be dropped
 * without anyone noticing. A conditional UPDATE is honest about what it does.
 *
 * The value is an ISO-8601 UTC timestamp compared as TEXT, which sorts
 * chronologically only because the format is fixed-width and always `Z`. Don't
 * write a different format into this row.
 */
async function acquireSweepLock(sb: SB): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const staleBefore = new Date(Date.now() - SWEEP_LOCK_TTL_MS).toISOString();
  // The row won't exist on a fresh database; create it already expired.
  await sb
    .from("oe_settings")
    .upsert({ key: SWEEP_LOCK_KEY, value: new Date(0).toISOString() }, { onConflict: "key", ignoreDuplicates: true });
  const { data } = await sb
    .from("oe_settings")
    .update({ value: nowIso, updated_at: nowIso })
    .eq("key", SWEEP_LOCK_KEY)
    .lt("value", staleBefore)
    .select("key");
  return (data ?? []).length > 0;
}

/** Hand the lock back immediately rather than waiting out the TTL, so a 5-second
 *  round doesn't block the next cron tick two minutes later. */
async function releaseSweepLock(sb: SB): Promise<void> {
  await sb
    .from("oe_settings")
    .update({ value: new Date(0).toISOString(), updated_at: new Date().toISOString() })
    .eq("key", SWEEP_LOCK_KEY);
}

// deno-lint-ignore no-explicit-any
async function sweepStalePending(
  sb: SB,
  filter: { eventId?: string; locationId?: string },
): Promise<SweepResult> {
  const out: SweepResult = { scanned: 0, confirmed: 0, released: 0, skipped: 0 };
  const cutoff = new Date(Date.now() - HOLD_STALE_MINUTES * 60 * 1000).toISOString();
  let q = sb
    .from("oe_bookings")
    .select("id, booking_id, stripe_session_id")
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true }) // oldest first: they hold seats longest
    .limit(SWEEP_LIMIT);
  if (filter.eventId) q = q.eq("event_id", filter.eventId);
  if (filter.locationId) q = q.eq("ghl_location_id", filter.locationId);
  const { data } = await q;
  const rows = data ?? [];
  out.scanned = rows.length;
  if (!rows.length) return out; // common case: nothing stale, zero Stripe calls

  const release = async (id: string, note: string) => {
    // booked_seats cascade-delete with the row, but delete explicitly so seats
    // free immediately even though we keep the (cancelled) booking for history.
    await sb.from("oe_booked_seats").delete().eq("booking_id", id);
    await sb
      .from("oe_bookings")
      .update({ status: "cancelled", payment_note: note, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending");
    out.released++;
  };

  // deno-lint-ignore no-explicit-any
  let stripe: any = null;
  for (const r of rows) {
    // No session at all — createCheckout deletes the booking when session
    // creation fails, so this is a row that can never be paid. Nothing to
    // verify and nothing to expire; holding its seats forever is the worse bug.
    if (!r.stripe_session_id) {
      await release(r.id, "No checkout session (auto-released)");
      continue;
    }

    try {
      if (!stripe) stripe = (await resolveOeStripe(sb)).stripe;
      const s = await stripe.checkout.sessions.retrieve(r.stripe_session_id);
      const paid = s?.payment_status === "paid" || s?.status === "complete";
      if (paid) {
        await sb
          .from("oe_bookings")
          .update({ status: "confirmed", payment_note: "Reconciled (paid, late)", updated_at: new Date().toISOString() })
          .eq("id", r.id)
          .eq("status", "pending");
        out.confirmed++;
        continue;
      }
      // Kill the session BEFORE the seats go back on sale. An already-expired
      // session needs no call — expiring it again just errors.
      //
      // ⚠️ THE LOCK WE DIDN'T WRITE. Between the retrieve above and this line the
      // customer can pay. Nothing on our side prevents that; what saves us is that
      // STRIPE REFUSES TO EXPIRE A SESSION THAT IS NO LONGER OPEN — the call
      // throws, we fall into the catch, and the seats are never released. Every
      // other guard here is ours; this one is Stripe's, it is invisible in the
      // code, and it would fail SILENTLY if Stripe ever softened that behaviour
      // (an expire that "succeeds" on a paid session = seats resold under a paying
      // customer). If you touch this ordering, re-verify that property first.
      if (s?.status !== "expired") {
        await stripe.checkout.sessions.expire(r.stripe_session_id);
      }
      await release(r.id, "Payment not completed (auto-released)");
    } catch (e) {
      // Retrieve failed, or expire failed → we do NOT know the money is safe, so
      // the seats stay held and this row waits for the next round.
      out.skipped++;
      console.error("oe.sweepStalePending: skipped, Stripe call failed", {
        bookingCode: r.booking_id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return out;
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
  event: { id: string; display_label: string; title_zh: string | null; price_per_seat: number };
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
    .select("id, display_label, title_zh, status, price_per_seat, seat_selection_enabled")
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
  // `?? 0`, never `?? 2`: a sub-account with no settings row must get NOTHING for
  // free. This is its own decision point — it reads the sub-account ROW, so
  // default_free_seats never reaches it and no amount of admin configuration can
  // correct a wrong number here. Must stay in step with the four fallbacks in
  // loadSettings above and in offline-event-admin's getSettings.
  const freeAllot = Number(sa?.free_seats ?? 0);
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

    // ── sweepAll: the CRON entry point (batch 6) ─────────────────────────────
    // Handled before the location guard on purpose: it sweeps EVERY location, so
    // it has no location_id to be scoped by — which also means it cannot lean on
    // the location/tool-access checks the other actions use. Its only gate is the
    // shared secret below.
    if (action === "sweepAll") {
      const expected = Deno.env.get("OE_CRON_SECRET") ?? "";
      const provided = req.headers.get("x-oe-cron-secret") ?? "";
      // A missing secret, a wrong secret and an unconfigured server all return the
      // EXACT same 401 body. Telling a caller which one it was tells them how to
      // get closer. The server log says which — the log is ours, the body is theirs.
      if (!expected) {
        console.error("oe.sweepAll: OE_CRON_SECRET is not configured — refusing every call");
        return json({ error: "unauthorized" }, 401);
      }
      if (!secretsMatch(provided, expected)) return json({ error: "unauthorized" }, 401);

      // Overlap guard. pg_net is fire-and-forget, so a round that outlives the
      // 2-minute cron tick would have the next one pile on top of it. Nothing
      // would CORRUPT (every write is guarded by .eq("status","pending") and the
      // seat delete is idempotent) but the counters would double-count and we
      // would pay for duplicate Stripe calls — and those counters are the only
      // way anyone watches this job.
      if (!(await acquireSweepLock(sb))) {
        return json({ ok: true, scanned: 0, confirmed: 0, released: 0, skipped: "locked" });
      }
      try {
        const result = await sweepStalePending(sb, {});
        return json({ ok: true, ...result });
      } finally {
        await releaseSweepLock(sb);
      }
    }

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
            // holdMinutes travels to the client so the "finish paying within N
            // minutes" copy can never disagree with the sweep. It is the SAME
            // constant the sweep uses — change HOLD_STALE_MINUTES and every
            // sentence follows. Hardcoding it in the UI is how the payment page
            // ended up promising "~30 minutes" after the window became 10.
            settings: { maxSeats: s.maxSeats, lunchPrice: s.lunchPrice, sstRate: s.sstRate, holdMinutes: HOLD_STALE_MINUTES },
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
          // Take the number from whichever source actually governs this event, so
          // the displayed "N left" can't disagree with what oe_claim_seats will
          // allow. Seat selection ON → the floor plan (a hand-typed capacity is
          // no longer written for those, and an old one must not win); OFF →
          // capacity, which is that path's only limit.
          const planSeatCount = e.floor_plan_id ? planSeats[e.floor_plan_id as string] ?? 0 : 0;
          const cap = e.seat_selection_enabled !== false
            ? planSeatCount
            : (e.capacity != null ? Number(e.capacity) : 0);
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
          v: 1, bookingId, email, phone, eventId: plan.event.id, eventLabel: snapshotEventName(plan.event), totalSeats: plan.seatCount,
        });

        const { data: inserted, error: insErr } = await sb
          .from("oe_bookings")
          .insert({
            booking_id: bookingId,
            event_id: plan.event.id,
            event_label: snapshotEventName(plan.event),
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
            event_label: snapshotEventName(plan.event),
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
          v: 1, bookingId, email, phone, eventId: plan.event.id, eventLabel: snapshotEventName(plan.event), totalSeats: plan.seatCount,
        });

        const { data: inserted, error: insErr } = await sb
          .from("oe_bookings")
          .insert({
            booking_id: bookingId,
            event_id: plan.event.id,
            event_label: snapshotEventName(plan.event),
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

        // 3) Hosted Stripe Checkout session. The summary is ITEMISED (paid
        //    tickets / free tickets / lunch / SST) so the Stripe page and the
        //    receipt show what the money actually bought, instead of one lumped
        //    subtotal. metadata.bookingId lets the webhook find this row.
        try {
          const { stripe } = await resolveOeStripe(sb);
          const subtotalCents = Math.round(plan.subtotal * 100);
          const sstCents = Math.round(plan.sst * 100);
          const totalCents = Math.round(plan.total * 100);
          // Percentage is DERIVED, never hardcoded — the rate is an admin setting.
          const sstPct = Number((plan.sstRate * 100).toFixed(2));
          // Line-item names are FIXED CHINESE this round. The bilingual-name +
          // Stripe `locale` decision is DEFERRED to batch 6 (see PROGRESS).
          const myr = (name: string, unitAmount: number, quantity: number) => ({
            price_data: { currency: "myr", product_data: { name }, unit_amount: unitAmount },
            quantity,
          });

          // deno-lint-ignore no-explicit-any
          const itemised: any[] = [];
          if (plan.paidSeats > 0) {
            itemised.push(
              myr(`门票 · ${snapshotEventName(plan.event)}`, Math.round(plan.pricePerSeat * 100), plan.paidSeats),
            );
          }
          // A 0-amount line IS accepted by Stripe as long as the session total is
          // > 0 (verified against the sandbox API before this shipped). Worth a
          // row of its own: without it the seat count the customer sees on the
          // Stripe page wouldn't match the seats on their ticket.
          if (plan.freeUsedNow > 0) itemised.push(myr("免费票（额度内）", 0, plan.freeUsedNow));
          if (plan.lunchQty > 0) {
            itemised.push(myr("午餐（两天）", Math.round(plan.lunchPrice * 100), plan.lunchQty));
          }
          if (sstCents > 0) itemised.push(myr(`SST ${sstPct}%`, sstCents, 1));

          // The previous LUMPED shape (subtotal + SST), kept only as the fallback
          // for the cent check below.
          // deno-lint-ignore no-explicit-any
          const lumped: any[] = [
            myr(`${snapshotEventName(plan.event)} — ${plan.seatCount} seat(s)`, subtotalCents, 1),
          ];
          if (sstCents > 0) lumped.push(myr(`SST ${sstPct}%`, sstCents, 1));

          // ── CENT CHECK ────────────────────────────────────────────────────
          // The itemised lines must charge EXACTLY oe_bookings.total, because
          // that column is what confirmBooking reconciles the payment against —
          // a one-cent difference is a wrong charge. Per-line rounding can drift
          // from the whole-order rounding once a price has sub-cent decimals
          // (e.g. RM33.333/seat: round(3333.3)*3 ≠ round(9999.9)). If the lines
          // don't add up we charge the OLD lumped shape instead: uglier, but the
          // total is always right. Never "fix" this by adjusting a line.
          const itemisedCents = itemised.reduce(
            (n: number, li: { price_data: { unit_amount: number }; quantity: number }) =>
              n + li.price_data.unit_amount * li.quantity,
            0,
          );
          let lineItems = itemised;
          if (itemisedCents !== totalCents) {
            // Edge-function log (Supabase → Functions → Logs), NOT the browser
            // console. This fallback is SILENT to the customer.
            console.error("oe.createCheckout: itemised cent mismatch — using the lumped summary", {
              bookingCode: bookingId,
              sum: itemisedCents,
              totalCents,
              lineItems: itemised.map((li) => ({
                name: li.price_data.product_data.name,
                unit_amount: li.price_data.unit_amount,
                quantity: li.quantity,
              })),
            });
            lineItems = lumped;
          }

          // Stripe's FLOOR for `expires_at` is 30 minutes — it rejects anything
          // shorter. That is why this is 30 min while seats are only held
          // HOLD_STALE_MINUTES (10). The gap is covered by the sweep explicitly
          // calling sessions.expire() before it frees the seats; do NOT read this
          // number as the seat-hold window.
          const HOLD_SECONDS = 30 * 60;
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

          // holdMinutes again (see resolveContext): the waiting screen the customer
          // stares at is rendered from this response, and its promise about how
          // long the seats are held must come from the constant that enforces it.
          return json({ ok: true, checkoutUrl: session.url, bookingCode: bookingId, holdMinutes: HOLD_STALE_MINUTES });
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
            // SNAPSHOT — the name printed on this ticket when it was issued.
            // Deliberately NOT re-read from the event, so a renamed event doesn't
            // retroactively rewrite tickets already in customers' hands.
            event_label: b.event_label,
            // Live event fields, for rendering the date/time the same way the
            // event card does (the card and the ticket share one formatter).
            title_zh: ev?.title_zh ?? null,
            title_en: ev?.title_en ?? null,
            start_date: ev?.start_date ?? null,
            end_date: ev?.end_date ?? null,
            start_time: ev?.start_time ?? null,
            end_time: ev?.end_time ?? null,
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
