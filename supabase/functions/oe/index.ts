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
// toggle. P3 ships READ paths only: resolveContext / listEvents / getEvent. The
// booking WRITE path (atomic seat claim) lands in P4/P5.
// ════════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, serviceClient } from "../_shared/ghl.ts";
import { hasToolAccess } from "../_shared/access.ts";

const TOOL_KEY = "offline_event";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const locationId = String(body?.location_id || body?.locationId || "").trim();
    const sb = serviceClient();

    // Identity is required for every action — this is a per-sub-account tool.
    if (!locationId) return json({ error: "location_required" }, 400);

    switch (action) {
      // ── Resolve the caller's context (identity + tool access + free allowance) ─
      case "resolveContext": {
        // Auto-register the sub-account on first visit (default 1 slot = 2 seats).
        // Done here via the SERVICE ROLE — the old app did this with the anon key
        // straight from the browser (a write hole); we don't.
        await sb
          .from("oe_subaccount_settings")
          .upsert(
            { location_id: locationId, free_tickets: 1, free_seats: 2 },
            { onConflict: "location_id", ignoreDuplicates: true },
          );

        // Tool on/off is owned by the Admin Portal (location_tool_access).
        const enabled = await hasToolAccess(sb, locationId, TOOL_KEY);
        if (!enabled) return json({ context: { enabled: false } });

        const { data: settings } = await sb
          .from("oe_subaccount_settings")
          .select("free_tickets, free_seats")
          .eq("location_id", locationId)
          .maybeSingle();
        const freeTickets = Number(settings?.free_tickets ?? 1);
        const freeSeats = Number(settings?.free_seats ?? 2);

        // Free seats already redeemed by this sub-account (active bookings only).
        const { data: used } = await sb
          .from("oe_bookings")
          .select("free_seats")
          .eq("ghl_location_id", locationId)
          .neq("status", "cancelled")
          .eq("is_archived", false);
        const freeSeatsUsed = (used ?? []).reduce(
          (n, r) => n + (Array.isArray(r.free_seats) ? r.free_seats.length : 0),
          0,
        );

        // Business name — best-effort (never block a real user on a lookup miss).
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

        // Effective capacity per event = explicit cap else the floor plan's
        // physical seat count. Booked = claimed seats for that event.
        const planIds = [...new Set(list.map((e) => e.floor_plan_id).filter(Boolean))] as string[];
        const planSeats: Record<string, number> = {};
        if (planIds.length) {
          const { data: plans } = await sb
            .from("oe_floor_plans")
            .select("id, physical_seats")
            .in("id", planIds);
          for (const p of plans ?? []) planSeats[p.id as string] = Number(p.physical_seats ?? 0);
        }

        const ids = list.map((e) => e.id as string);
        const bookedByEvent: Record<string, number> = {};
        if (ids.length) {
          const { data: seats } = await sb
            .from("oe_booked_seats")
            .select("event_id")
            .in("event_id", ids);
          for (const s of seats ?? []) {
            bookedByEvent[s.event_id as string] = (bookedByEvent[s.event_id as string] || 0) + 1;
          }
        }

        const events_out = list.map((e) => {
          const cap = e.capacity != null ? Number(e.capacity) : (e.floor_plan_id ? planSeats[e.floor_plan_id as string] ?? 0 : 0);
          const booked = bookedByEvent[e.id as string] || 0;
          return {
            ...e,
            capacity_effective: cap,
            booked_seats: booked,
            seats_left: cap > 0 ? Math.max(0, cap - booked) : null,
          };
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

        const { data: claimed } = await sb
          .from("oe_booked_seats")
          .select("seat_label")
          .eq("event_id", eventId);
        const bookedSeats = (claimed ?? []).map((r) => r.seat_label as string);

        return json({ event, floorPlan, bookedSeats });
      }

      default:
        return json({ error: `Unknown action: ${action || "(none)"}` }, 400);
    }
  } catch (e) {
    console.error("oe fn error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
