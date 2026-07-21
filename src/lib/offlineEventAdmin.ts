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
