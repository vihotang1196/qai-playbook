// ════════════════════════════════════════════════════════════════════════
// Helpdesk admin edge function (agency-internal — QAI's shared help center).
//
// EVERY action is gated by requireAdmin() first: it validates the caller's
// Supabase session JWT + checks the platform_admins allowlist, BEFORE any
// service-role work. Same security model as the platform `admin` fn, but
// tool-owned — all Helpdesk admin surface (knowledge CRUD, Notion sync,
// conversations, analytics, updates, FAQ, settings) lives here so the platform
// fn stays lean. Callable with the public anon key (verify_jwt off at the
// gateway) because requireAdmin is the real, server-enforced gate. The frontend
// never touches hd_ tables directly.
//
// P2 ships `overview` (live counts) — proves the authenticated data path end to
// end. Later phases add the CRUD actions.
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
      // ── Live overview counts across the shared help center ──────────────
      case "overview": {
        const count = (table: string) => sb.from(table).select("id", { count: "exact", head: true });

        const [articles, folders, conversations, faq, updates] = await Promise.all([
          count("hd_articles"),
          count("hd_folders"),
          count("hd_conversations"),
          count("hd_faq"),
          count("hd_updates"),
        ]);

        // Notion connection state — never returns the api_key itself.
        const { data: notion } = await sb
          .from("hd_notion_settings")
          .select("api_key, database_ids")
          .limit(1)
          .maybeSingle();
        const notionConnected = !!(notion?.api_key && String(notion.api_key).trim());
        const notionDatabases = Array.isArray(notion?.database_ids) ? notion!.database_ids.length : 0;

        return json({
          overview: {
            counts: {
              articles: articles.count ?? 0,
              folders: folders.count ?? 0,
              conversations: conversations.count ?? 0,
              faq: faq.count ?? 0,
              updates: updates.count ?? 0,
            },
            notion: { connected: notionConnected, databases: notionDatabases },
          },
        });
      }

      default:
        return json({ error: `Unknown action: ${action || "(none)"}` }, 400);
    }
  } catch (e) {
    console.error("helpdesk-admin fn error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
