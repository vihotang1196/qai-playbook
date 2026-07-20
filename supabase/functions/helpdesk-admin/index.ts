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

      // ── Knowledge base: folders + article list (no bodies) ──────────────
      case "listKnowledge": {
        const [foldersRes, articlesRes] = await Promise.all([
          sb.from("hd_folders").select("id, name, icon, sort_order").order("sort_order").order("name"),
          sb
            .from("hd_articles")
            .select("id, title, category, folder_id, source, source_id, sort_order, updated_at")
            .order("sort_order")
            .order("updated_at", { ascending: false }),
        ]);
        if (foldersRes.error) throw foldersRes.error;
        if (articlesRes.error) throw articlesRes.error;
        return json({ folders: foldersRes.data ?? [], articles: articlesRes.data ?? [] });
      }

      // ── One article incl. body (for the editor) ─────────────────────────
      case "getArticle": {
        const id = String(body?.id || "").trim();
        if (!id) return json({ error: "id required" }, 400);
        const { data, error } = await sb.from("hd_articles").select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "not_found" }, 404);
        return json({ article: data });
      }

      // ── Create / update an article (manual path). On UPDATE we never touch
      //    source / source_id, so a Notion-linked article keeps its linkage. ─
      case "saveArticle": {
        const id = String(body?.id || "").trim();
        const title = String(body?.title || "").trim();
        const content = typeof body?.content === "string" ? body.content : "";
        const category = String(body?.category || "general").trim() || "general";
        const folder_id = body?.folder_id ? String(body.folder_id) : null;
        const sort_order = Number.isFinite(Number(body?.sort_order)) ? Number(body.sort_order) : 0;
        if (!title) return json({ error: "title required" }, 400);

        if (id) {
          const { data, error } = await sb
            .from("hd_articles")
            .update({ title, content, category, folder_id, sort_order })
            .eq("id", id)
            .select("id")
            .maybeSingle();
          if (error) throw error;
          if (!data) return json({ error: "not_found" }, 404);
          return json({ ok: true, id: data.id });
        }
        const { data, error } = await sb
          .from("hd_articles")
          .insert({ title, content, category, folder_id, sort_order, source: "manual" })
          .select("id")
          .single();
        if (error) throw error;
        return json({ ok: true, id: data.id });
      }

      case "deleteArticle": {
        const id = String(body?.id || "").trim();
        if (!id) return json({ error: "id required" }, 400);
        const { error } = await sb.from("hd_articles").delete().eq("id", id);
        if (error) throw error;
        return json({ ok: true });
      }

      // ── Create / update a folder ────────────────────────────────────────
      case "saveFolder": {
        const id = String(body?.id || "").trim();
        const name = String(body?.name || "").trim();
        const icon = body?.icon ? String(body.icon).trim() : null;
        const sort_order = Number.isFinite(Number(body?.sort_order)) ? Number(body.sort_order) : 0;
        if (!name) return json({ error: "name required" }, 400);

        if (id) {
          const { data, error } = await sb
            .from("hd_folders")
            .update({ name, icon, sort_order })
            .eq("id", id)
            .select("id")
            .maybeSingle();
          if (error) throw error;
          if (!data) return json({ error: "not_found" }, 404);
          return json({ ok: true, id: data.id });
        }
        const { data, error } = await sb.from("hd_folders").insert({ name, icon, sort_order }).select("id").single();
        if (error) throw error;
        return json({ ok: true, id: data.id });
      }

      // ── Delete a folder. Articles' folder_id → NULL automatically (the FK
      //    is ON DELETE SET NULL), so no article is lost — just uncategorised. ─
      case "deleteFolder": {
        const id = String(body?.id || "").trim();
        if (!id) return json({ error: "id required" }, 400);
        const { error } = await sb.from("hd_folders").delete().eq("id", id);
        if (error) throw error;
        return json({ ok: true });
      }

      default:
        return json({ error: `Unknown action: ${action || "(none)"}` }, 400);
    }
  } catch (e) {
    console.error("helpdesk-admin fn error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
