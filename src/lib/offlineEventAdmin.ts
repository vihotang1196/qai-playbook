import { getSupabase } from "@/lib/supabase";
import type { OeFloorPlanLayout } from "@/lib/offlineEvent";

// Offline Event admin data API — wraps the requireAdmin-gated `offline-event-admin`
// edge fn (same pattern as adminApi.ts / the helpdesk-admin client). invoke
// auto-attaches the admin's session token; every action is re-verified server-side
// by requireAdmin. The frontend holds no privilege of its own and NEVER touches the
// RLS-locked oe_ tables directly.

async function callOeAdmin<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke("offline-event-admin", {
    body: { action, ...payload },
  });
  if (error) {
    // Surface the server's {error} (e.g. not_authorized) when present, and
    // attach the full parsed body as `.detail` so callers can read extra fields
    // (e.g. saveFloorPlan's booked_seats_removed → { missing: [...] }).
    let msg = error instanceof Error ? error.message : "request failed";
    let body: unknown = null;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        body = await ctx.json();
        if ((body as { error?: string })?.error) msg = String((body as { error: string }).error);
      }
    } catch {
      /* keep generic */
    }
    const err = new Error(msg) as Error & { detail?: unknown };
    if (body) err.detail = body;
    throw err;
  }
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

export type OfflineEventOverview = {
  counts: {
    eventsTotal: number;
    eventsLive: number;
    floorPlans: number;
    bookingsTotal: number;
    bookingsConfirmed: number;
    bookingsPending: number;
    seatsClaimed: number;
  };
  revenue: number;
};

/** Live counts for the admin landing. Scoped to admins server-side. */
export async function getOverview(): Promise<OfflineEventOverview> {
  const { overview } = await callOeAdmin<{ overview: OfflineEventOverview }>("overview");
  return overview;
}

// ── P6 check-in ───────────────────────────────────────────────────────────

export type OeCheckinEvent = {
  id: string;
  display_label: string;
  start_date: string;
  end_date: string;
  time_slot: string;
  theme_zh: string | null;
  theme_en: string | null;
  status: string;
};

/** Events the admin can pick as the "active" door to check people into. */
export async function getCheckinEvents(): Promise<OeCheckinEvent[]> {
  const { events } = await callOeAdmin<{ events: OeCheckinEvent[] }>("checkinEvents");
  return events ?? [];
}

export type OeCheckinRecent = {
  booking_id: string;
  email: string;
  seats: string[];
  checkedInAt: string | null;
};

export type OeCheckinBoard = {
  total: number; // confirmed tickets for the event
  attended: number; // checked in that day
  recent: OeCheckinRecent[];
};

/** Live "已签 X / 共 Y" board + recent check-ins for a chosen event + day. */
export async function getCheckinBoard(eventId: string, day: 1 | 2): Promise<OeCheckinBoard> {
  const { board } = await callOeAdmin<{ board: OeCheckinBoard }>("checkinBoard", { eventId, day });
  return board;
}

export type OeCheckinResult = {
  result: "ok" | "already" | "not_found" | "wrong_event";
  code?: string;
  booking?: {
    booking_id: string;
    email: string;
    seats: string[];
    event_label: string;
    day: 1 | 2;
    checkedInAt?: string | null;
  };
  scannedEventLabel?: string;
};

/**
 * Mark a scanned booking attended for day 1 / 2, locked to `eventId`.
 * Idempotent server-side — a re-scan returns `already` and never double-counts.
 */
export async function checkIn(bookingId: string, eventId: string, day: 1 | 2): Promise<OeCheckinResult> {
  return await callOeAdmin<OeCheckinResult>("checkIn", { bookingId, eventId, day });
}

// ── P7a bookings management ─────────────────────────────────────────────────

export type OeBookingStatus = "pending" | "confirmed" | "cancelled";
export type OeDayStatus = "pending" | "attended" | "not_attending";

export type OeBookingRow = {
  booking_id: string;
  email: string;
  phone: string;
  event_id: string | null;
  event_label: string;
  free_seats: string[];
  addon_seats: string[];
  seats: string[];
  lunch_qty: number;
  subtotal: number | null;
  sst_amount: number | null;
  total: number;
  status: OeBookingStatus;
  payment_note: string | null;
  receipt_url: string | null;
  day1_status: OeDayStatus;
  day2_status: OeDayStatus;
  day1_checked_in_at: string | null;
  day2_checked_in_at: string | null;
  ghl_location_id: string | null;
  is_archived: boolean;
  created_at: string;
};

export type ListBookingsParams = {
  eventId?: string;
  status?: OeBookingStatus | "";
  locationId?: string;
  search?: string;
  includeArchived?: boolean;
  limit?: number;
};

/** List bookings with filters + free-text search (by BK code / email) + total. */
export async function listBookings(params: ListBookingsParams = {}): Promise<{ bookings: OeBookingRow[]; total: number }> {
  return await callOeAdmin<{ bookings: OeBookingRow[]; total: number }>("listBookings", params);
}

export type OeBookingDetail = OeBookingRow & { qr_payload: string; archived_at: string | null; created_by: string | null };
export type OeBookingEvent = {
  id: string;
  display_label: string;
  start_date: string;
  end_date: string;
  time_slot: string;
  price_per_seat: number;
  status: string;
  floor_plan_id: string | null;
  seat_selection_enabled: boolean;
} | null;

/** Full detail for one booking + its event. */
export async function getBookingDetail(bookingId: string): Promise<{ booking: OeBookingDetail; event: OeBookingEvent }> {
  return await callOeAdmin<{ booking: OeBookingDetail; event: OeBookingEvent }>("getBookingDetail", { bookingId });
}

/** Cancel (void + free seats, keep row as cancelled). Idempotent. */
export async function cancelBooking(bookingId: string): Promise<{ ok: boolean; alreadyCancelled?: boolean }> {
  return await callOeAdmin<{ ok: boolean; alreadyCancelled?: boolean }>("cancelBooking", { bookingId });
}

/** Archive / un-archive (hide from the active list). */
export async function archiveBooking(bookingId: string, archived = true): Promise<{ ok: boolean; archived: boolean }> {
  return await callOeAdmin<{ ok: boolean; archived: boolean }>("archiveBooking", { bookingId, archived });
}

// ── P7a-2 manual add-ticket + change-seat + change-date ─────────────────────

export type OeLocation = { location_id: string; business_name: string | null };

/** Sub-accounts for the manual add-ticket location picker. */
export async function listLocations(): Promise<OeLocation[]> {
  const { locations } = await callOeAdmin<{ locations: OeLocation[] }>("listLocations");
  return locations ?? [];
}

export type OeSeatmapEvent = {
  id: string;
  display_label: string;
  start_date: string;
  end_date: string;
  price_per_seat: number;
  capacity: number | null;
  floor_plan_id: string | null;
  seat_selection_enabled: boolean;
  status: string;
};

/**
 * Floor-plan layout + already-claimed seat labels for an event's seat picker.
 * Pass `excludeBookingId` (change-seat) to omit that booking's own seats so they
 * show free and can be re-selected.
 */
export async function getEventSeatmap(
  eventId: string,
  excludeBookingId?: string,
): Promise<{ event: OeSeatmapEvent; layout: unknown; bookedLabels: string[] }> {
  return await callOeAdmin("getEventSeatmap", { eventId, excludeBookingId });
}

export type AddBookingParams = {
  locationId: string;
  eventId: string;
  seats: string[];
  email: string;
  phone?: string;
  lunchQty?: number;
  amount?: number;
  note?: string;
};

/** Manually create a CONFIRMED booking (3rd-party / offline payment). */
export async function addBooking(params: AddBookingParams): Promise<{ ok: boolean; booking: { booking_id: string } }> {
  return await callOeAdmin("addBooking", params);
}

/** Swap a booking's seats within the same event (atomic; same seat count). */
export async function changeSeats(bookingId: string, seats: string[]): Promise<{ ok: boolean }> {
  return await callOeAdmin("changeSeats", { bookingId, seats });
}

/** Move a booking to another event (atomic; same seat count). */
export async function changeEvent(bookingId: string, newEventId: string, seats: string[]): Promise<{ ok: boolean }> {
  return await callOeAdmin("changeEvent", { bookingId, newEventId, seats });
}

// ── P7b event-date management ───────────────────────────────────────────────

export type OeEventStatus = "live" | "display" | "off";

export type OeAdminEvent = {
  id: string;
  display_label: string;
  start_date: string;
  end_date: string;
  time_slot: string;
  theme_zh: string | null;
  theme_en: string | null;
  notice_zh: string | null;
  notice_en: string | null;
  price_per_seat: number;
  capacity: number | null;
  floor_plan_id: string | null;
  seat_selection_enabled: boolean;
  status: OeEventStatus;
  sort_order: number;
  // computed
  claimed_seats: number;
  booking_count: number;
  floor_plan_name: string | null;
};

export type OeFloorPlanOption = { id: string; name: string; physical_seats: number };

/** Event form payload (create/update). capacity: "" or null → derive from plan. */
export type OeEventInput = {
  display_label: string;
  start_date: string;
  end_date: string;
  time_slot: string;
  theme_zh: string;
  theme_en: string;
  notice_zh: string;
  notice_en: string;
  price_per_seat: number | string;
  capacity: number | string | null;
  floor_plan_id: string | null;
  seat_selection_enabled: boolean;
  status: OeEventStatus;
  sort_order: number | string;
};

/** All events (any status) + claimed/booking counts + the floor-plan options. */
export async function listEventsAdmin(): Promise<{ events: OeAdminEvent[]; floorPlans: OeFloorPlanOption[] }> {
  return await callOeAdmin("listEventsAdmin");
}

export async function createEvent(event: OeEventInput): Promise<{ ok: boolean; id: string }> {
  return await callOeAdmin("createEvent", { event });
}

export async function updateEvent(id: string, event: OeEventInput): Promise<{ ok: boolean }> {
  return await callOeAdmin("updateEvent", { id, event });
}

export async function deleteEvent(id: string): Promise<{ ok: boolean }> {
  return await callOeAdmin("deleteEvent", { id });
}

// ── P7c settings ────────────────────────────────────────────────────────────

export type OeStripeMode = "sandbox" | "live";

export type OeSettingsValues = {
  stripe_payment_mode: OeStripeMode;
  sst_rate: string; // fraction, e.g. "0.08"
  lunch_price: string;
  max_seats_per_booking: string;
  default_free_tickets: string;
  default_free_seats: string;
};

/** What the money path would ACTUALLY do right now — resolved server-side by the
 *  same code a real charge uses, so the UI can't show a mode the charge won't
 *  honour. `keyPrefix` is only the identifying prefix (e.g. "sk_live_"). */
export type OeActiveStripe = {
  mode: "sandbox" | "live";
  keyPrefix: string;
  configured: boolean;
  secretName: string;
};

/** Broadcast after the Stripe mode is changed, so the always-on badge in the
 *  admin shell re-reads immediately instead of waiting for a reload. */
export const OE_STRIPE_MODE_EVENT = "oe:stripe-mode-changed";

export type OeSettingsResponse = {
  settings: OeSettingsValues;
  liveKeyConfigured: boolean;
  activeStripe?: OeActiveStripe;
  pendingCount: number;
};

export async function getSettings(): Promise<OeSettingsResponse> {
  return await callOeAdmin("getSettings");
}

/** Update the non-Stripe-mode settings. sst_rate is a FRACTION (0.08 = 8%). */
export async function updateSettings(settings: Partial<{
  sst_rate: number | string;
  lunch_price: number | string;
  max_seats_per_booking: number | string;
  default_free_tickets: number | string;
  default_free_seats: number | string;
}>): Promise<{ ok: boolean }> {
  return await callOeAdmin("updateSettings", { settings });
}

/** Switch Stripe mode. Server rejects live when the live key isn't configured. */
export async function setStripeMode(mode: OeStripeMode): Promise<{ ok: boolean; mode: OeStripeMode }> {
  return await callOeAdmin("setStripeMode", { mode });
}

export type OeSubaccountRow = {
  location_id: string;
  business_name: string | null;
  free_tickets: number;
  free_seats: number;
  updated_at: string;
};

export async function listSubaccountSettings(): Promise<OeSubaccountRow[]> {
  const { rows } = await callOeAdmin<{ rows: OeSubaccountRow[] }>("listSubaccountSettings");
  return rows ?? [];
}

export async function updateSubaccountSettings(locationId: string, free_tickets: number, free_seats: number): Promise<{ ok: boolean }> {
  return await callOeAdmin("updateSubaccountSettings", { locationId, free_tickets, free_seats });
}

// ── Sub-account manager (all 911, server-paged) ─────────────────────────────

export type OeSubaccountManagerRow = {
  location_id: string;
  business_name: string | null;
  logo_url: string | null;
  /** null = no override row → inherits the global default. */
  free_tickets: number | null;
  free_seats: number | null;
  has_override: boolean;
  /** May this sub-account book offline classes? (explicit opt-out only) */
  oe_enabled: boolean;
  /** Playbook master switch — READ-ONLY here; edited on the Sub Account page. */
  playbook_enabled: boolean;
};

export type OeSubaccountPage = {
  rows: OeSubaccountManagerRow[];
  total: number;
  page: number;
  pageSize: number;
  defaults: { free_tickets: number; free_seats: number };
  canary: boolean;
};

/** One page of ALL sub-accounts (not just those with an override row).
 *  Search + paging are server-side, so a search spans all of them. */
export async function listSubaccounts(
  opts: { query?: string; page?: number; pageSize?: number } = {},
): Promise<OeSubaccountPage> {
  return await callOeAdmin("listSubaccounts", {
    query: opts.query ?? "",
    page: opts.page ?? 1,
    pageSize: opts.pageSize ?? 50,
  });
}

/** Turn offline-class booking on/off for ONE sub-account. Independent of the
 *  Playbook master switch (both must be on to book). */
export async function setOeAccess(locationId: string, enabled: boolean): Promise<{ ok: boolean; enabled: boolean }> {
  return await callOeAdmin("setOeAccess", { locationId, enabled });
}

// ── P7d permanent delete ────────────────────────────────────────────────────

/** Permanently delete a booking (frees its seats). Irreversible. */
export async function deleteBookingHard(bookingId: string): Promise<{ ok: boolean }> {
  return await callOeAdmin("deleteBookingHard", { bookingId });
}

/** Permanently delete a sub-account's free-allowance override row. */
export async function deleteSubaccountSettings(locationId: string): Promise<{ ok: boolean }> {
  return await callOeAdmin("deleteSubaccountSettings", { locationId });
}

// ── P8 floor-plan management ────────────────────────────────────────────────

export type OeAdminFloorPlan = {
  id: string;
  name: string;
  is_default: boolean;
  layout_data: OeFloorPlanLayout;
  physical_seats: number;
  used_by: string[]; // event labels
  used_by_count: number;
  booked_seats: number;
};

export async function listFloorPlans(): Promise<OeAdminFloorPlan[]> {
  const { plans } = await callOeAdmin<{ plans: OeAdminFloorPlan[] }>("listFloorPlans");
  return plans ?? [];
}

/** Create (id null/"") or update a floor plan. Server recomputes physical_seats
 *  and blocks removing/disabling a currently-booked seat. */
export async function saveFloorPlan(id: string | null, name: string, layout: OeFloorPlanLayout): Promise<{ ok: boolean; id: string }> {
  return await callOeAdmin("saveFloorPlan", { id: id ?? "", name, layout });
}

export async function deleteFloorPlan(id: string): Promise<{ ok: boolean }> {
  return await callOeAdmin("deleteFloorPlan", { id });
}

export async function setDefaultFloorPlan(id: string): Promise<{ ok: boolean }> {
  return await callOeAdmin("setDefaultFloorPlan", { id });
}

export async function duplicateFloorPlan(id: string, name: string): Promise<{ ok: boolean; id: string }> {
  return await callOeAdmin("duplicateFloorPlan", { id, name });
}
