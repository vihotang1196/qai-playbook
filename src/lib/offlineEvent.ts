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
export type OeSettings = { maxSeats: number; lunchPrice: number; sstRate: number };

export type OeContext = {
  enabled: boolean;
  businessName?: string | null;
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
  start_date: string;
  end_date: string;
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
export type OeFloorPlanLayout = {
  columns: number;
  rows: number;
  stage: boolean;
  door: "bottom-right" | "bottom-center" | "none";
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
  input: { event_id: string; email: string; phone?: string; seats?: string[]; quantity?: number; lunch_qty?: number; origin: string },
): Promise<{ ok: true; checkoutUrl: string; bookingCode: string }> {
  return callOe("createCheckout", locationId, input);
}

export type OeBookingStatus = "pending" | "confirmed" | "cancelled" | "not_found";

/** Poll one booking's status (return page). Scoped server-side to this location. */
export async function getBooking(
  locationId: string,
  bookingCode: string,
): Promise<{ status: OeBookingStatus; booking?: OeBooking }> {
  return callOe("getBooking", locationId, { booking_code: bookingCode });
}

// ── Layout → seat-map conversion (ported from the old floorPlans.ts) ──────
/** Seat label as stored/rendered everywhere: "G5 Seat 1". */
export function seatLabel(groupId: string, seatNumber: number): string {
  return `${groupId} Seat ${seatNumber}`;
}

function normalizeLayout(raw: unknown): OeFloorPlanLayout {
  const l = (raw ?? {}) as Partial<OeFloorPlanLayout>;
  const tables = Array.isArray(l.tables) ? l.tables : [];
  return {
    columns: typeof l.columns === "number" ? l.columns : 6,
    rows: typeof l.rows === "number" ? l.rows : 5,
    stage: l.stage !== false,
    door: l.door === "none" || l.door === "bottom-center" ? l.door : "bottom-right",
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
