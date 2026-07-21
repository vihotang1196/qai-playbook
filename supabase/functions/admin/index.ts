// ════════════════════════════════════════════════════════════════════════
// Admin Portal edge function (platform-wide, all tools).
//
// EVERY action is gated by requireAdmin() first — validates the caller's session
// JWT + checks the platform_admins allowlist, before any privileged work runs
// with the service role. Callable with the public anon key (verify_jwt off at
// the gateway) because requireAdmin is the real, server-enforced gate.
//
// Step A ships `whoami` only. Step B adds the god-view (list sub-accounts,
// per-tool access toggles, audit) as more actions here.
// ════════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, serviceClient } from "../_shared/ghl.ts";
import { requireAdmin } from "../_shared/admin.ts";

// Tool registry (server-side mirror of src/lib/admin/tools.ts). Access can only
// be set for a known tool_key.
const KNOWN_TOOLS = new Set(["review_boost", "copywriter", "offline_event"]);

// Keep a PostgREST .or() filter safe from an admin's search string.
const cleanQuery = (s: string) => s.replace(/[,()%*]/g, " ").trim();

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
      case "whoami":
        return json({ admin });

      // ── Sub-account list + their per-tool access state ──────────────────
      case "listLocations": {
        const query = cleanQuery(String(body?.query || ""));
        const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 200);

        let q = sb
          .from("ghl_locations")
          .select("location_id, business_name, logo_url, niche")
          .order("business_name", { ascending: true })
          .limit(limit);
        if (query) q = q.or(`business_name.ilike.%${query}%,location_id.ilike.%${query}%`);

        const { data: locs, error } = await q;
        if (error) throw error;

        const ids = (locs ?? []).map((l) => l.location_id as string);
        const accessMap: Record<string, Record<string, boolean>> = {};
        if (ids.length) {
          const { data: access, error: aErr } = await sb
            .from("location_tool_access")
            .select("location_id, tool_key, enabled")
            .in("location_id", ids);
          if (aErr) throw aErr;
          for (const a of access ?? []) {
            (accessMap[a.location_id as string] ||= {})[a.tool_key as string] = a.enabled as boolean;
          }
        }

        const { count } = await sb.from("ghl_locations").select("location_id", { count: "exact", head: true });
        const locations = (locs ?? []).map((l) => ({ ...l, access: accessMap[l.location_id as string] || {} }));
        return json({ locations, total: count ?? null, capped: !query && (locs?.length ?? 0) >= limit });
      }

      // ── Toggle a (sub-account, tool) on/off + write audit ───────────────
      case "setToolAccess": {
        const location_id = String(body?.location_id || "").trim();
        const tool_key = String(body?.tool_key || "").trim();
        const enabled = !!body?.enabled;
        if (!location_id) return json({ error: "location_id required" }, 400);
        if (!KNOWN_TOOLS.has(tool_key)) return json({ error: "unknown tool_key" }, 400);

        const { data: cur, error: curErr } = await sb
          .from("location_tool_access")
          .select("enabled")
          .eq("location_id", location_id)
          .eq("tool_key", tool_key)
          .maybeSingle();
        if (curErr) throw curErr;
        const from = cur ? (cur.enabled as boolean) : true; // default-allow

        const { error: upErr } = await sb.from("location_tool_access").upsert(
          { location_id, tool_key, enabled, updated_at: new Date().toISOString(), updated_by: admin.user_id },
          { onConflict: "location_id,tool_key" },
        );
        if (upErr) throw upErr;

        await sb.from("admin_audit_log").insert({
          admin_user_id: admin.user_id,
          admin_email: admin.email,
          action: "set_tool_access",
          target_location_id: location_id,
          tool_key,
          detail: { from, to: enabled },
        });
        return json({ ok: true, enabled });
      }

      // ── Recent audit entries (enriched with business names) ─────────────
      case "listAudit": {
        const limit = Math.min(Math.max(Number(body?.limit) || 100, 1), 500);
        const { data: rows, error } = await sb
          .from("admin_audit_log")
          .select("id, admin_email, action, target_location_id, tool_key, detail, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw error;

        const ids = [...new Set((rows ?? []).map((r) => r.target_location_id).filter(Boolean))] as string[];
        const nameMap: Record<string, string> = {};
        if (ids.length) {
          const { data: locs } = await sb.from("ghl_locations").select("location_id, business_name").in("location_id", ids);
          for (const l of locs ?? []) nameMap[l.location_id as string] = (l.business_name as string) ?? "";
        }
        const audit = (rows ?? []).map((r) => ({
          ...r,
          business_name: r.target_location_id ? nameMap[r.target_location_id as string] ?? null : null,
        }));
        return json({ audit });
      }

      // ── Cross-tool usage overview (from tool_usage) ─────────────────────
      // Headline totals via cap-free COUNT queries; ranking / trend / by-tool
      // aggregated from recent rows (fine early — see PROGRESS pre-scale TODO:
      // move to a SQL group-by RPC before high volume).
      case "getUsageStats": {
        const [genRes, postedRes] = await Promise.all([
          sb.from("tool_usage").select("id", { count: "exact", head: true }).eq("event_type", "generation"),
          sb.from("tool_usage").select("id", { count: "exact", head: true }).eq("event_type", "posted"),
        ]);

        const since90 = new Date(Date.now() - 90 * 86_400_000).toISOString();
        const { data: rows, error } = await sb
          .from("tool_usage")
          .select("tool_key, location_id, created_at")
          .eq("event_type", "generation")
          .gte("created_at", since90)
          .order("created_at", { ascending: false })
          .limit(2000);
        if (error) throw error;
        const recent = rows ?? [];

        const byToolMap: Record<string, number> = {};
        const byLoc: Record<string, number> = {};
        const since30 = Date.now() - 30 * 86_400_000;
        const active = new Set<string>();
        const dayMap: Record<string, number> = {};
        for (const r of recent) {
          byToolMap[r.tool_key as string] = (byToolMap[r.tool_key as string] || 0) + 1;
          const t = new Date(r.created_at as string).getTime();
          if (r.location_id) {
            byLoc[r.location_id as string] = (byLoc[r.location_id as string] || 0) + 1;
            if (t >= since30) active.add(r.location_id as string);
          }
          if (t >= since30) {
            const k = String(r.created_at).slice(0, 10);
            dayMap[k] = (dayMap[k] || 0) + 1;
          }
        }

        const topIds = Object.entries(byLoc).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const nameMap: Record<string, string> = {};
        if (topIds.length) {
          const { data: locs } = await sb
            .from("ghl_locations")
            .select("location_id, business_name")
            .in("location_id", topIds.map(([id]) => id));
          for (const l of locs ?? []) nameMap[l.location_id as string] = (l.business_name as string) ?? "";
        }
        const topSubAccounts = topIds.map(([location_id, count]) => ({
          location_id,
          business_name: nameMap[location_id] ?? null,
          count,
        }));

        const daily: { date: string; count: number }[] = [];
        for (let i = 29; i >= 0; i--) {
          const k = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
          daily.push({ date: k, count: dayMap[k] || 0 });
        }

        return json({
          stats: {
            totals: {
              generations: genRes.count ?? 0,
              posted: postedRes.count ?? 0,
              activeSubAccounts: active.size,
            },
            byTool: Object.entries(byToolMap).map(([tool_key, count]) => ({ tool_key, count })),
            topSubAccounts,
            daily,
          },
        });
      }

      default:
        return json({ error: `Unknown action: ${action || "(none)"}` }, 400);
    }
  } catch (e) {
    console.error("admin fn error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
