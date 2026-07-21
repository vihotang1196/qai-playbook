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

      default:
        return json({ error: `Unknown action: ${action || "(none)"}` }, 400);
    }
  } catch (e) {
    console.error("offline-event-admin fn error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
