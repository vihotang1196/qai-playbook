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
import { isCanaryMode, playbookAllowed, PLAYBOOK_KEY } from "../_shared/access.ts";

// Tool registry (server-side mirror of src/lib/admin/tools.ts). Access can only
// be set for a known tool_key.
// `helpdesk` joined the list for the canary rollout: the help center's CONTENT
// stays agency-wide shared (never per-location), but during a gradual launch the
// owner still needs to control who can OPEN it.
const KNOWN_TOOLS = new Set(["review_boost", "copywriter", "offline_event", "helpdesk"]);

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
        // Compute the effective answer HERE, with the same helper the customer
        // gate uses, and ship it. The frontend must never re-derive it — a
        // second copy of the rule can drift, and an admin (who bypasses every
        // gate) would never see the toggle disagreeing with reality.
        const whitelistMode = await isCanaryMode(sb);
        const locations = (locs ?? []).map((l) => {
          const access = accessMap[l.location_id as string] || {};
          const stored = access[PLAYBOOK_KEY];
          return {
            ...l,
            access,
            playbook_enabled: playbookAllowed(stored === undefined ? null : stored, whitelistMode),
          };
        });
        return json({
          locations,
          total: count ?? null,
          capped: !query && (locs?.length ?? 0) >= limit,
          whitelistMode,
        });
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

      // ── The ONE master switch: may this sub-account use the Playbook? ───
      // The Playbook is sold as one product, not as separately-purchasable
      // tools, so this replaces the per-tool matrix. Stored in
      // location_tool_access under the reserved `playbook` key, so it reuses the
      // existing table + audit plumbing. Default (no row) = ON in normal mode,
      // OFF in canary mode (whitelist).
      case "setPlaybookAccess": {
        const location_id = String(body?.location_id || "").trim();
        const enabled = !!body?.enabled;
        if (!location_id) return json({ error: "location_id required" }, 400);

        const { data: cur, error: curErr } = await sb
          .from("location_tool_access")
          .select("enabled")
          .eq("location_id", location_id)
          .eq("tool_key", PLAYBOOK_KEY)
          .maybeSingle();
        if (curErr) throw curErr;
        const from = cur ? (cur.enabled as boolean) : null; // null = never set

        const { error: upErr } = await sb.from("location_tool_access").upsert(
          {
            location_id,
            tool_key: PLAYBOOK_KEY,
            enabled,
            updated_at: new Date().toISOString(),
            updated_by: admin.user_id,
          },
          { onConflict: "location_id,tool_key" },
        );
        if (upErr) throw upErr;

        await sb.from("admin_audit_log").insert({
          admin_user_id: admin.user_id,
          admin_email: admin.email,
          action: "set_playbook_access",
          target_location_id: location_id,
          tool_key: PLAYBOOK_KEY,
          detail: { from, to: enabled },
        });
        return json({ ok: true, enabled });
      }

      // ── Who has an EXPLICIT playbook row (the launch roster) ────────────
      // In 内测中 the "on" list is literally the whitelist; in 已全面开放 the
      // "off" list is who stays locked out. Without this the owner would have
      // to page through 911 rows to find out — which is exactly how the test
      // sub-account sat locked out unnoticed before launch.
      case "listPlaybookRoster": {
        const { data, error } = await sb
          .from("location_tool_access")
          .select("location_id, enabled")
          .eq("tool_key", PLAYBOOK_KEY)
          .limit(1000);
        if (error) throw error;
        const rows = data ?? [];
        const names: Record<string, string> = {};
        const ids = rows.map((r) => r.location_id as string);
        // Chunked: one .in() with hundreds of ids builds a URL long enough for
        // PostgREST to reject, and the failure is silent (every name goes null).
        for (let i = 0; i < ids.length; i += 100) {
          const { data: locs } = await sb
            .from("ghl_locations")
            .select("location_id, business_name")
            .in("location_id", ids.slice(i, i + 100));
          for (const l of locs ?? []) names[l.location_id as string] = (l.business_name as string) ?? "";
        }
        const shape = (want: boolean) =>
          rows
            .filter((r) => (r.enabled as boolean) === want)
            .map((r) => ({
              location_id: r.location_id as string,
              business_name: names[r.location_id as string] || null,
            }));
        return json({ on: shape(true), off: shape(false) });
      }

      // ── Canary (whitelist) rollout mode ─────────────────────────────────
      // ON  → location_tool_access is a WHITELIST: only sub-accounts explicitly
      //       switched on can use the tools (admins always can).
      // OFF → normal steady state: everyone can, except those switched off.
      case "getCanaryMode": {
        const { data, error } = await sb
          .from("platform_settings")
          .select("value, updated_at")
          .eq("key", "canary_mode")
          .maybeSingle();
        if (error) throw error;
        return json({
          ok: true,
          enabled: (data?.value as { enabled?: boolean } | null)?.enabled === true,
          updated_at: data?.updated_at ?? null,
        });
      }

      case "setCanaryMode": {
        const enabled = !!body?.enabled;
        const { data: cur } = await sb
          .from("platform_settings")
          .select("value")
          .eq("key", "canary_mode")
          .maybeSingle();
        const from = (cur?.value as { enabled?: boolean } | null)?.enabled === true;

        const { error } = await sb.from("platform_settings").upsert(
          {
            key: "canary_mode",
            value: { enabled },
            updated_at: new Date().toISOString(),
            updated_by: admin.user_id,
          },
          { onConflict: "key" },
        );
        if (error) throw error;

        // Platform-wide switch → audit it like any access change.
        await sb.from("admin_audit_log").insert({
          admin_user_id: admin.user_id,
          admin_email: admin.email,
          action: "set_canary_mode",
          detail: { from, to: enabled },
        });
        return json({ ok: true, enabled });
      }

      // ── Coaching Night sessions (Playbook homepage content) ─────────────
      // Lives here rather than in a tool fn: Coaching Night belongs to the
      // homepage, not to Offline Event / Helpdesk / Review Boost — same level as
      // setPlaybookAccess. Writes are admin-only; the public homepage reads the
      // replay list through the separate read-only `coaching` fn.
      case "listCoachingSessions": {
        // ALL rows, including replay-less ones (step 2's scheduled sessions), so
        // the admin list is never a subset of what the table actually holds.
        const { data, error } = await sb
          .from("coaching_sessions")
          .select("id, session_date, topic, replay_url, cover_url, created_at, updated_at")
          .order("session_date", { ascending: false })
          .limit(500);
        if (error) throw error;
        return json({ sessions: data ?? [] });
      }

      case "saveCoachingSession": {
        const id = String(body?.id || "").trim();
        const session_date = String(body?.session_date || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(session_date)) {
          return json({ error: "session_date required (YYYY-MM-DD)" }, 400);
        }
        const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
        const replay_url = body?.replay_url ? String(body.replay_url).trim() : null;
        const cover_url = body?.cover_url ? String(body.cover_url).trim() : null;
        const row = { session_date, topic, replay_url, cover_url };

        if (id) {
          const { data, error } = await sb
            .from("coaching_sessions")
            .update(row)
            .eq("id", id)
            .select("id")
            .single();
          if (error) throw error;
          return json({ ok: true, id: data.id });
        }
        const { data, error } = await sb
          .from("coaching_sessions")
          .insert(row)
          .select("id")
          .single();
        if (error) throw error;
        return json({ ok: true, id: data.id });
      }

      case "deleteCoachingSession": {
        const id = String(body?.id || "").trim();
        if (!id) return json({ error: "id required" }, 400);
        const { error } = await sb.from("coaching_sessions").delete().eq("id", id);
        if (error) throw error;
        return json({ ok: true });
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
