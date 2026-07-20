// ════════════════════════════════════════════════════════════════════════
// Helpdesk PUBLIC read API — the customer-facing help center (P6 widget) reads
// the shared knowledge base through here.
//
// The KB tables (hd_folders / hd_articles) are RLS-locked (service-role only),
// so the frontend can NOT read them directly. This anon-callable function runs
// with the service role internally and exposes ONLY read-only actions:
//   listFolders  — all category folders
//   listArticles — article list (no body; light for the list view)
//   getArticle   — one article's full body (incl. media URLs, for rendering)
//
// Read-only by design: no writes, no secrets returned, no per-location scoping
// (the help center is agency-wide SHARED content — same for every sub-account).
// The requireAdmin-gated `helpdesk-admin` fn stays the only WRITE path.
//
// Contrast:
//   helpdesk        (this) — public READS of the shared KB (the widget)
//   helpdesk-chat          — public AI chat over the KB (Angel AI)
//   helpdesk-admin         — requireAdmin-gated writes + Notion sync (back office)
// ════════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, serviceClient } from "../_shared/ghl.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();
    const sb = serviceClient();

    switch (action) {
      // All category folders (Notion section headings), display order first.
      case "listFolders": {
        const { data, error } = await sb
          .from("hd_folders")
          .select("id, name, icon, sort_order")
          .order("sort_order")
          .order("name");
        if (error) throw error;
        return json({ folders: data || [] });
      }

      // Article list — no body (kept light). The widget groups these by folder.
      case "listArticles": {
        const { data, error } = await sb
          .from("hd_articles")
          .select("id, title, category, folder_id, sort_order, updated_at")
          .order("sort_order")
          .order("title");
        if (error) throw error;
        return json({ articles: data || [] });
      }

      // One article's full markdown body (incl. permanent media URLs) for reading.
      case "getArticle": {
        const id = String(body?.id || "").trim();
        if (!id) return json({ error: "id required" }, 400);
        const { data, error } = await sb
          .from("hd_articles")
          .select("id, title, content, category, folder_id, source, updated_at")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "not_found" }, 404);
        return json({ article: data });
      }

      default:
        return json({ error: `unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("helpdesk (public) error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
