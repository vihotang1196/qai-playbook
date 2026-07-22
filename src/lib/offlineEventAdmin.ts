import { getSupabase } from "@/lib/supabase";

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
    // Surface the server's {error} (e.g. not_authorized) when present.
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
