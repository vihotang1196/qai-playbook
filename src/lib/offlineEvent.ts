import { getSupabase } from "@/lib/supabase";

// Offline Event — CUSTOMER data API. Wraps the location-scoped `oe` edge fn
// (anon key; every action re-scoped by location_id + gated by
// location_tool_access server-side). The frontend never touches the oe_ tables.

async function callOe<T>(action: string, locationId: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke("oe", {
    body: { action, location_id: locationId, ...payload },
  });
  if (error) {
    let msg = error instanceof Error ? error.message : "request failed";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const b = await ctx.json();
        if (b?.error) msg = String(b.error);
      }
    } catch {
      /* keep generic */
    }
    throw new Error(msg);
  }
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

// ── Types ─────────────────────────────────────────────────────────────────
export type OeSettings = {
  maxSeats: number;
  lunchPrice: number;
  sstRate: number;
  /** How long unpaid seats are held, from the server's HOLD_STALE_MINUTES. Any
   *  "pay within N minutes" copy MUST read this — never a literal, or the promise
   *  drifts from the sweep that enforces it. Optional: an older server omits it,
   *  and the right response to "we don't know" is to say nothing. */
  holdMinutes?: number;
};

export type OeContext = {
  enabled: boolean;
  businessName?: string | null;
  /** @deprecated Removed from the server response 2026-08-05. It was never read
   *  here; the allowance is `freeSeats` / `freeSeatsRemaining`. */
  freeTickets?: number;
  freeSeats?: number;
  freeSeatsUsed?: number;
  freeSeatsRemaining?: number;
  settings?: OeSettings;
};

export type OePriceBreakdown = {
  seatCount: number;
  freeUsedNow: number;
  paidSeats: number;
  pricePerSeat: number;
  lunchQty: number;
  lunchPrice: number;
  subtotal: number;
  sst: number;
  total: number;
};

export type OeBooking = {
  booking_id: string;
  qr_payload: string;
  seats: string[];
  event_label: string;
  email: string;
  total: number;
  free_used: number;
};

/** createBooking result: free bookings complete (ok+booking); paid ones return
 *  requiresPayment + the breakdown (payment lands in P5). */
export type OeBookingResult =
  | { ok: true; booking: OeBooking }
  | { requiresPayment: true; breakdown: OePriceBreakdown };

export type OeEvent = {
  id: string;
  display_label: string;
  title_zh: string | null;
  title_en: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  time_slot: string;
  status: "live" | "display" | "off";
  price_per_seat: number;
  capacity: number | null;
  theme_zh: string | null;
  theme_en: string | null;
  notice_zh: string | null;
  notice_en: string | null;
  floor_plan_id: string | null;
  seat_selection_enabled: boolean;
  // added by listEvents
  capacity_effective?: number;
  booked_seats?: number;
  seats_left?: number | null;
};

// Seat-map shapes (mirror the old app's types/booking.ts + floorPlans.ts).
export type OeSeat = {
  id: string;
  groupId: string;
  seatNumber: 1 | 2 | 3 | 4 | 5 | 6;
  status: "available" | "booked";
};
export type OeSeatGroup = {
  id: string;
  label: string;
  type: "G" | "V";
  shape?: "cluster" | "long";
  col: number;
  row: number;
  seats: OeSeat[];
  missingSeats?: number[];
};
export type OeFloorPlanTable = {
  id: string;
  label: string;
  shape?: "cluster" | "long";
  col: number;
  row: number;
  seats: number[];
  missingSeats: number[];
  disabledSeats: number[];
};
/** Which edge the door sits on (or none). It then slides along that edge via doorPos. */
export type OeDoorEdge = "none" | "bottom" | "top";
export type OeDivider = { enabled: boolean; axis: "vertical" | "horizontal"; pos: number };
export type OeFloorPlanLayout = {
  columns: number;
  rows: number;
  stage: boolean;
  /** Where the stage sits relative to the seat rows (default top). */
  stagePosition?: "top" | "bottom";
  door: OeDoorEdge;
  /** Door position along its edge, 0-100% (left→right). Default ~85%. */
  doorPos?: number;
  /** Optional dashed boundary line. When absent, a vertical line auto-draws at
   *  75% only if a long table exists (legacy behaviour). */
  divider?: OeDivider;
  tables: OeFloorPlanTable[];
};

// ── API calls ───────────────────────────────────────────────────────────
export async function resolveContext(locationId: string): Promise<OeContext> {
  const { context } = await callOe<{ context: OeContext }>("resolveContext", locationId);
  return context;
}

export async function listEvents(locationId: string): Promise<OeEvent[]> {
  const { events } = await callOe<{ events: OeEvent[] }>("listEvents", locationId);
  return events || [];
}

export async function getEvent(
  locationId: string,
  eventId: string,
): Promise<{
  event: OeEvent;
  floorPlan: { id: string; layout_data: unknown; physical_seats: number } | null;
  bookedSeats: string[];
}> {
  return callOe("getEvent", locationId, { event_id: eventId });
}

/** Create a booking. FREE (total ≤ 0) completes immediately with a QR ticket;
 *  paid returns { requiresPayment } → the caller then calls createCheckout.
 *  Everything is validated + priced server-side; seats are claimed atomically
 *  (no same-seat double-book). */
export async function createBooking(
  locationId: string,
  input: { event_id: string; email: string; phone?: string; seats?: string[]; quantity?: number; lunch_qty?: number },
): Promise<OeBookingResult> {
  return callOe<OeBookingResult>("createBooking", locationId, input);
}

/** Start a PAID booking: server writes a pending booking + atomically holds the
 *  seats, then returns a Stripe hosted-Checkout URL. The caller redirects there;
 *  Stripe redirects back to /checkout/return, where the webhook-confirmed booking
 *  shows its QR ticket. `origin` = window.location.origin (for the return URLs). */
export async function createCheckout(
  locationId: string,
  input: {
    event_id: string; email: string; phone?: string; seats?: string[]; quantity?: number;
    lunch_qty?: number; origin: string;
    /** OPTIONAL. True when booking from inside the GHL iframe, so the return and
     *  cancel pages know they are a spawned tab and can offer to close
     *  themselves. Omitting it keeps the pre-existing behaviour exactly. */
    embed?: boolean;
  },
): Promise<{ ok: true; checkoutUrl: string; bookingCode: string; holdMinutes?: number }> {
  return callOe("createCheckout", locationId, input);
}

export type OeBookingStatus = "pending" | "confirmed" | "cancelled" | "not_found";

/** Poll one booking's status (read-only). Scoped server-side to this location. */
export async function getBooking(
  locationId: string,
  bookingCode: string,
): Promise<{ status: OeBookingStatus; booking?: OeBooking }> {
  return callOe("getBooking", locationId, { booking_code: bookingCode });
}

/** Confirm a paid booking on return from Stripe. The SERVER verifies the payment
 *  with the secret key (retrieves the Checkout session) before flipping pending →
 *  confirmed — the browser's claim of "paid" is never trusted. Idempotent. */
export async function confirmBooking(
  locationId: string,
  args: { session_id?: string; booking_code?: string },
): Promise<{ status: OeBookingStatus; booking?: OeBooking }> {
  return callOe("confirmBooking", locationId, args);
}

// ── "My bookings" (team view: all confirmed tickets for this location) ──────
export type OeMyBooking = {
  booking_id: string;
  email: string;
  event_label: string;
  title_zh: string | null;
  title_en: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  time_slot: string | null;
  theme_zh: string | null;
  theme_en: string | null;
  seats: string[];
  lunch_qty: number;
  total: number;
  qr_payload: string;
};

/** All CONFIRMED tickets under this location (team-shared). Scoped server-side
 *  by location_id — one location never sees another's bookings. */
export async function listMyBookings(locationId: string): Promise<OeMyBooking[]> {
  const { bookings } = await callOe<{ bookings: OeMyBooking[] }>("listMyBookings", locationId);
  return bookings || [];
}

// ── Layout → seat-map conversion (ported from the old floorPlans.ts) ──────
/** Seat label as stored/rendered everywhere: "G5 Seat 1". */
export function seatLabel(groupId: string, seatNumber: number): string {
  return `${groupId} Seat ${seatNumber}`;
}

/** Map any stored door value (new edge, or legacy bottom-left/center/right/top)
 *  to { door: edge, doorPos: % }. Legacy positions become sensible % defaults. */
function normalizeDoor(rawDoor: unknown, rawDoorPos: unknown): { door: OeDoorEdge; doorPos: number } {
  let door: OeDoorEdge = "bottom";
  let pos = 85;
  switch (String(rawDoor ?? "")) {
    case "none": door = "none"; break;
    case "top": door = "top"; pos = 50; break;
    case "bottom": door = "bottom"; pos = 50; break;
    case "bottom-left": door = "bottom"; pos = 15; break;
    case "bottom-center": door = "bottom"; pos = 50; break;
    case "bottom-right": door = "bottom"; pos = 85; break;
    default: door = "bottom"; pos = 85;
  }
  const p = Number(rawDoorPos);
  if (Number.isFinite(p)) pos = Math.max(0, Math.min(100, p));
  return { door, doorPos: pos };
}

function normalizeDivider(raw: unknown): OeDivider | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const d = raw as Partial<OeDivider>;
  const pos = Number(d.pos);
  return {
    enabled: !!d.enabled,
    axis: d.axis === "horizontal" ? "horizontal" : "vertical",
    pos: Number.isFinite(pos) ? Math.max(0, Math.min(100, pos)) : 50,
  };
}

export function normalizeLayout(raw: unknown): OeFloorPlanLayout {
  const l = (raw ?? {}) as Partial<OeFloorPlanLayout>;
  const tables = Array.isArray(l.tables) ? l.tables : [];
  return {
    columns: typeof l.columns === "number" ? l.columns : 6,
    rows: typeof l.rows === "number" ? l.rows : 5,
    stage: l.stage !== false,
    stagePosition: l.stagePosition === "bottom" ? "bottom" : "top",
    ...normalizeDoor(l.door, l.doorPos),
    divider: normalizeDivider(l.divider),
    tables: tables.map((t) => ({
      id: String((t as OeFloorPlanTable).id),
      label: String((t as OeFloorPlanTable).label ?? (t as OeFloorPlanTable).id),
      shape: (t as OeFloorPlanTable).shape === "long" ? "long" : "cluster",
      col: Number((t as OeFloorPlanTable).col) || 1,
      row: Number((t as OeFloorPlanTable).row) || 0,
      seats: Array.isArray((t as OeFloorPlanTable).seats)
        ? (t as OeFloorPlanTable).seats.map(Number).filter((n) => n >= 1 && n <= 6)
        : [1, 2, 3, 4],
      missingSeats: Array.isArray((t as OeFloorPlanTable).missingSeats)
        ? (t as OeFloorPlanTable).missingSeats.map(Number)
        : [],
      disabledSeats: Array.isArray((t as OeFloorPlanTable).disabledSeats)
        ? (t as OeFloorPlanTable).disabledSeats.map(Number)
        : [],
    })),
  };
}

/** Convert a stored floor-plan layout (+ already-claimed seat labels) into the
 *  SeatGroup[] the SeatMap renders. Disabled seats fold into blank slots;
 *  fully-disabled tables are dropped; claimed seats render as "booked". */
export function layoutToSeatGroups(raw: unknown, bookedLabels: string[] = []): {
  groups: OeSeatGroup[];
  layout: OeFloorPlanLayout;
} {
  const layout = normalizeLayout(raw);
  const booked = new Set(bookedLabels);
  const groups: OeSeatGroup[] = [];
  for (const t of layout.tables) {
    const disabled = new Set(t.disabledSeats);
    const missing = new Set<number>(t.missingSeats);
    disabled.forEach((n) => missing.add(n));
    const activeSeatNums = t.seats.filter((n) => !disabled.has(n) && !t.missingSeats.includes(n));
    if (activeSeatNums.length === 0) continue;
    groups.push({
      id: t.id,
      label: t.label,
      type: "G",
      shape: t.shape ?? "cluster",
      col: t.col,
      row: t.row,
      seats: activeSeatNums.map((n) => ({
        id: `${t.id}-${n}`,
        groupId: t.id,
        seatNumber: n as 1 | 2 | 3 | 4 | 5 | 6,
        status: booked.has(seatLabel(t.id, n)) ? ("booked" as const) : ("available" as const),
      })),
      missingSeats: Array.from(missing),
    });
  }
  return { groups, layout };
}

// ── "Keep only the first N seats" (batch 8a) ────────────────────────────────
// Since batch 6 commit 4 the floor plan is the ONLY place a seat-selection event's
// headcount is set, and the editor could only toggle one seat at a time — 91 down
// to 60 meant 31 clicks. This does it in one step.

/** One physical seat, with everything needed to order it. */
type SeatSlot = { tableId: string; col: number; row: number; seat: number; label: string };

/**
 * Every physical seat, ordered NEAREST THE STAGE FIRST. Real venues shrink from
 * the back, so "the first N" has to mean "closest to the stage": rows outward
 * from the stage, then left→right, then seat number. `stagePosition: "bottom"`
 * flips the row direction — otherwise "first" would mean the far wall.
 * `missingSeats` are excluded: those seats do not physically exist.
 */
function orderedSeatSlots(layout: OeFloorPlanLayout): SeatSlot[] {
  const slots: SeatSlot[] = [];
  for (const t of layout.tables) {
    const missing = new Set(t.missingSeats ?? []);
    for (const n of t.seats) {
      if (missing.has(n)) continue;
      slots.push({ tableId: t.id, col: t.col, row: t.row, seat: n, label: seatLabel(t.id, n) });
    }
  }
  const fromBottom = layout.stagePosition === "bottom";
  return slots.sort((a, b) => {
    if (a.row !== b.row) return fromBottom ? b.row - a.row : a.row - b.row;
    if (a.col !== b.col) return a.col - b.col;
    return a.seat - b.seat;
  });
}

export type KeepFirstNSeatsResult =
  | {
      ok: true;
      layout: OeFloorPlanLayout;
      /** What was asked for. */
      requested: number;
      /** What the plan will actually have — higher than `requested` when booked
       *  seats sit beyond the cut and had to stay enabled. */
      effective: number;
      /** Seats this turns off. */
      disabledCount: number;
      /** Booked seats kept enabled despite falling outside the first N. */
      bookedOutside: string[];
      /** Enabled seats in the baseline, i.e. the ceiling for `requested`. */
      available: number;
    }
  | { ok: false; error: "invalid_n" }
  | { ok: false; error: "below_booked"; bookedCount: number };

/** The failure half of the union, as one name. */
export type KeepFirstNSeatsFailure = Extract<KeepFirstNSeatsResult, { ok: false }>;

/**
 * `if (!r.ok)` reads better and SHOULD be enough — but this project compiles with
 * `strictNullChecks: false`, under which TypeScript stops narrowing a union on a
 * boolean-literal discriminant, so the call site ends up seeing the success shape
 * and erroring on `.error`. (Verified: flip `strictNullChecks` on and those errors
 * vanish with no code change.) An explicit type predicate narrows regardless of
 * that setting.
 *
 * Delete this and go back to `!r.ok` the day the project turns strictNullChecks on.
 */
export function keepFirstNSeatsFailed(r: KeepFirstNSeatsResult): r is KeepFirstNSeatsFailure {
  return !r.ok;
}

/** Distinguishes the two failure reasons — same narrowing caveat as above. */
export function isBelowBooked(
  r: KeepFirstNSeatsFailure,
): r is Extract<KeepFirstNSeatsResult, { error: "below_booked" }> {
  return r.error === "below_booked";
}

/**
 * Disable everything after the first N seats.
 *
 * ALWAYS RECOMPUTED FROM `baseline`, never from its own output — otherwise
 * applying 60 twice would shrink to 60 of 60's tail and keep eating the plan. The
 * caller passes the layout AS THE EDITOR OPENED IT, which also means seats that
 * were already deliberately disabled (the default hall keeps G24–G28 off) stay
 * off instead of being resurrected by a large N.
 *
 * Booked seats are NEVER disabled, even beyond the cut: `saveFloorPlan` rejects
 * the whole save if a booked seat is disabled (`booked_seats_removed`), so
 * silently including one would turn a routine change into an unexplainable
 * failure. They are reported instead, and they push `effective` above `requested`.
 *
 * `missingSeats` is never touched — that is the venue's physical shape, not a
 * sales decision.
 */
export function keepFirstNSeats(
  baseline: OeFloorPlanLayout,
  n: number,
  bookedLabels: string[] = [],
): KeepFirstNSeatsResult {
  if (!Number.isFinite(n) || Math.floor(n) !== n || n < 1) return { ok: false, error: "invalid_n" };

  const baselineDisabled = new Set<string>();
  for (const t of baseline.tables) {
    for (const s of t.disabledSeats ?? []) baselineDisabled.add(seatLabel(t.id, s));
  }
  const slots = orderedSeatSlots(baseline);
  const candidates = slots.filter((s) => !baselineDisabled.has(s.label));

  // Only bookings on seats this plan actually has can constrain it.
  const physical = new Set(slots.map((s) => s.label));
  const booked = [...new Set(bookedLabels)].filter((l) => physical.has(l));
  if (n < booked.length) return { ok: false, error: "below_booked", bookedCount: booked.length };

  const keep = new Set(candidates.slice(0, n).map((s) => s.label));
  const bookedOutside = booked.filter((l) => !keep.has(l));
  for (const l of bookedOutside) keep.add(l);

  const layout: OeFloorPlanLayout = {
    ...baseline,
    tables: baseline.tables.map((t) => {
      const missing = new Set(t.missingSeats ?? []);
      return {
        ...t,
        disabledSeats: t.seats.filter((s) => !missing.has(s) && !keep.has(seatLabel(t.id, s))),
      };
    }),
  };

  return {
    ok: true,
    layout,
    requested: n,
    effective: keep.size,
    disabledCount: candidates.length - Math.min(n, candidates.length) - bookedOutside.length,
    bookedOutside,
    available: candidates.length,
  };
}
