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
import {
  fetchDatabasePages,
  getPage,
  pageTitle,
  folderNameForDatabase,
  blocksToMarkdown,
} from "../_shared/notion.ts";

// Media persistence: download a Notion-hosted (expiring) URL → upload to the
// public helpdesk-media bucket → return the permanent public URL. Fault-tolerant
// (returns null on any failure so a bad asset never fails the whole article) and
// idempotent (keyed by block id, upsert). Skips oversized files to protect the
// function's memory.
const MEDIA_MAX_BYTES = 45 * 1024 * 1024;
function extForMedia(contentType: string, url: string): string {
  const ct = (contentType || "").toLowerCase().split(";")[0].trim();
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/heic": "heic",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "video/x-m4v": "m4v",
    "application/pdf": "pdf",
  };
  if (map[ct]) return map[ct];
  const m = url.split("?")[0].match(/\.([a-z0-9]{2,5})$/i);
  return m ? m[1].toLowerCase() : "bin";
}
async function persistMedia(
  sb: ReturnType<typeof serviceClient>,
  sourceUrl: string,
  blockId: string,
): Promise<string | null> {
  try {
    const resp = await fetch(sourceUrl);
    if (!resp.ok) return null;
    const clen = Number(resp.headers.get("content-length") || 0);
    if (clen && clen > MEDIA_MAX_BYTES) return null;
    const contentType = resp.headers.get("content-type") || "application/octet-stream";
    const buf = new Uint8Array(await resp.arrayBuffer());
    if (buf.byteLength > MEDIA_MAX_BYTES) return null;
    const path = `notion/${blockId}.${extForMedia(contentType, sourceUrl)}`;
    const up = await sb.storage.from("helpdesk-media").upload(path, buf, { contentType, upsert: true });
    if (up.error) return null;
    const { data } = sb.storage.from("helpdesk-media").getPublicUrl(path);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}

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
        // Look up the source BEFORE deleting → tombstone Notion articles so a
        // later re-sync won't resurrect them.
        const { data: art } = await sb.from("hd_articles").select("source, source_id").eq("id", id).maybeSingle();
        const { error } = await sb.from("hd_articles").delete().eq("id", id);
        if (error) throw error;
        if (art?.source === "notion" && art.source_id) {
          const { data: tomb } = await sb
            .from("hd_deleted_notion_entries")
            .select("id")
            .eq("source_id", art.source_id)
            .maybeSingle();
          if (!tomb) await sb.from("hd_deleted_notion_entries").insert({ source_id: art.source_id });
        }
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

      // ── Notion: test a database connection (P4a) — reads title + counts
      //    pages via pagination. Imports NOTHING. Handled failures come back as
      //    { ok:false, message } (not thrown) so the UI can show them plainly. ─
      case "testNotion": {
        const databaseId = String(body?.database_id || "").trim();
        if (!databaseId) return json({ ok: false, message: "请填写数据库 ID" });

        const key = Deno.env.get("NOTION_API_KEY");
        if (!key) {
          return json({ ok: false, message: "NOTION_API_KEY 未配置（请在 Supabase secret 里设置后重试）" });
        }

        const notionHeaders = {
          Authorization: `Bearer ${key}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        };

        // 1) Database metadata → title
        const metaResp = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
          headers: notionHeaders,
        });
        if (!metaResp.ok) {
          const status = metaResp.status;
          let message = `Notion 返回错误 ${status}`;
          if (status === 401) message = "密钥无效或未授权，请检查 Supabase secret 里的 NOTION_API_KEY";
          else if (status === 404)
            message =
              "找不到该数据库：确认 ID 正确，且已在 Notion 里把这个数据库分享给你的集成（••• → Connections → 选你的集成）";
          else if (status === 400) message = "数据库 ID 格式不正确（应为 32 位字符）";
          return json({ ok: false, message });
        }
        const meta = await metaResp.json();
        const title =
          (meta.title || []).map((t: { plain_text?: string }) => t?.plain_text || "").join("").trim() || "(无标题)";

        // 2) Count pages by paginating ids only (no block/content reads)
        let count = 0;
        let cursor: string | undefined = undefined;
        let loops = 0;
        do {
          const qResp = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
            method: "POST",
            headers: notionHeaders,
            body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
          });
          if (!qResp.ok) {
            return json({ ok: false, message: `列出页面失败（Notion 返回 ${qResp.status}）` });
          }
          const q = await qResp.json();
          count += (q.results || []).length;
          cursor = q.has_more ? q.next_cursor : undefined;
          loops++;
          if (loops > 200) break; // safety cap (~20000 pages)
        } while (cursor);

        return json({ ok: true, title, pageCount: count });
      }

      // ── Notion: list every database this integration can see (P4a helper).
      //    Uses Notion search, then counts pages per db (globally bounded so a
      //    huge workspace can't time out). Imports nothing. This is how the
      //    owner finds their real database id + which one holds the articles. ─
      case "listNotionDatabases": {
        const key = Deno.env.get("NOTION_API_KEY");
        if (!key) return json({ ok: false, message: "NOTION_API_KEY 未配置" });

        const notionHeaders = {
          Authorization: `Bearer ${key}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        };

        // 1) search → every database shared with the integration
        const found: { id: string; title: string; url: string | null }[] = [];
        let cursor: string | undefined = undefined;
        let loops = 0;
        do {
          const resp = await fetch("https://api.notion.com/v1/search", {
            method: "POST",
            headers: notionHeaders,
            body: JSON.stringify({
              filter: { property: "object", value: "database" },
              page_size: 100,
              start_cursor: cursor,
            }),
          });
          if (!resp.ok) {
            if (resp.status === 401) return json({ ok: false, message: "密钥无效或未授权，请检查 NOTION_API_KEY" });
            return json({ ok: false, message: `搜索失败（Notion 返回 ${resp.status}）` });
          }
          const data = await resp.json();
          for (const d of data.results || []) {
            const title = (d.title || []).map((t: { plain_text?: string }) => t?.plain_text || "").join("").trim() || "(无标题)";
            found.push({ id: d.id, title, url: d.url || null });
          }
          cursor = data.has_more ? data.next_cursor : undefined;
          loops++;
          if (loops > 20) break;
        } while (cursor);

        // 2) count pages per db, bounded by a global request budget
        let budget = 80;
        const databases: { id: string; title: string; url: string | null; pageCount: number; capped: boolean }[] = [];
        for (const d of found) {
          let count = 0;
          let c2: string | undefined = undefined;
          let capped = false;
          do {
            if (budget <= 0) {
              capped = true;
              break;
            }
            const qr = await fetch(`https://api.notion.com/v1/databases/${d.id}/query`, {
              method: "POST",
              headers: notionHeaders,
              body: JSON.stringify({ page_size: 100, start_cursor: c2 }),
            });
            budget--;
            if (!qr.ok) break;
            const q = await qr.json();
            count += (q.results || []).length;
            c2 = q.has_more ? q.next_cursor : undefined;
          } while (c2);
          databases.push({ id: d.id, title: d.title, url: d.url, pageCount: count, capped });
        }

        // Most-articles first — the owner's real library floats to the top.
        databases.sort((a, b) => b.pageCount - a.pageCount);
        return json({ ok: true, databases });
      }

      // ── Notion synced-database list (the owner's manual list) ───────────
      case "getNotionConfig": {
        const { data } = await sb.from("hd_notion_settings").select("database_ids").limit(1).maybeSingle();
        return json({ database_ids: (data?.database_ids as string[]) || [] });
      }

      case "addNotionDatabase": {
        const id = String(body?.database_id || "").trim();
        if (!id) return json({ error: "database_id required" }, 400);
        const { data } = await sb.from("hd_notion_settings").select("id, database_ids").limit(1).maybeSingle();
        const current: string[] = (data?.database_ids as string[]) || [];
        if (!current.includes(id)) current.push(id);
        if (data?.id) {
          await sb.from("hd_notion_settings").update({ database_ids: current }).eq("id", data.id);
        } else {
          await sb.from("hd_notion_settings").insert({ database_ids: current });
        }
        return json({ ok: true, database_ids: current });
      }

      case "removeNotionDatabase": {
        const id = String(body?.database_id || "").trim();
        if (!id) return json({ error: "database_id required" }, 400);
        const { data } = await sb.from("hd_notion_settings").select("id, database_ids").limit(1).maybeSingle();
        const current: string[] = ((data?.database_ids as string[]) || []).filter((x) => x !== id);
        if (data?.id) await sb.from("hd_notion_settings").update({ database_ids: current }).eq("id", data.id);
        await sb.from("hd_sync_queue").delete().eq("database_id", id); // drop its work-list
        return json({ ok: true, database_ids: current });
      }

      // ── Plan a sync: list the database's pages, mark which need import
      //    (new/changed) vs skip (already up-to-date via notion_last_edited),
      //    rebuild the queue. Fast — no block reads. ────────────────────────
      case "planNotionSync": {
        const databaseId = String(body?.database_id || "").trim();
        if (!databaseId) return json({ error: "database_id required" }, 400);
        const force = !!body?.force; // re-import everything (e.g. to backfill media)
        const key = Deno.env.get("NOTION_API_KEY");
        if (!key) return json({ ok: false, message: "NOTION_API_KEY 未配置" });

        let pages: { id: string; last_edited_time: string }[];
        try {
          pages = await fetchDatabasePages(key, databaseId);
        } catch (e) {
          return json({ ok: false, message: `列出页面失败：${e instanceof Error ? e.message : e}` });
        }

        // Resolve the folder ONCE (= the layout's section heading) + ensure it.
        let folderId: string | null = null;
        let folderName = "";
        try {
          folderName = await folderNameForDatabase(key, databaseId);
          if (folderName) {
            const { data: f } = await sb.from("hd_folders").select("id").eq("name", folderName).limit(1).maybeSingle();
            if (f?.id) folderId = f.id as string;
            else {
              const { data: created } = await sb.from("hd_folders").insert({ name: folderName }).select("id").single();
              folderId = (created?.id as string) ?? null;
            }
          }
        } catch {
          folderId = null; // don't fail planning over foldering
        }

        // Existing imported versions for these pages (chunked .in lookups).
        const existing = new Map<string, string | null>();
        const ids = pages.map((p) => p.id);
        for (let i = 0; i < ids.length; i += 100) {
          const chunk = ids.slice(i, i + 100);
          const { data: arts } = await sb
            .from("hd_articles")
            .select("source_id, notion_last_edited")
            .eq("source", "notion")
            .in("source_id", chunk);
          for (const a of arts || []) existing.set(a.source_id as string, a.notion_last_edited as string | null);
        }

        // Tombstones — pages the admin deleted must NEVER be re-imported (even
        // with force). Skip them.
        const { data: deletedRows } = await sb.from("hd_deleted_notion_entries").select("source_id");
        const tombstoned = new Set((deletedRows || []).map((d) => d.source_id as string));

        await sb.from("hd_sync_queue").delete().eq("database_id", databaseId);
        const rows = pages.map((p) => {
          const imported = existing.get(p.id);
          const unchanged =
            !force && imported && new Date(imported).getTime() === new Date(p.last_edited_time).getTime();
          const skip = tombstoned.has(p.id) || unchanged;
          return {
            database_id: databaseId,
            page_id: p.id,
            page_last_edited: p.last_edited_time,
            status: skip ? "skipped" : "pending",
            folder_id: folderId,
          };
        });
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await sb.from("hd_sync_queue").insert(rows.slice(i, i + 500));
          if (error) throw error;
        }

        // Re-folder already-imported (skipped) articles to the resolved folder —
        // so changing/fixing the folder scheme corrects them without re-import.
        if (folderId) {
          const skippedIds = rows.filter((r) => r.status === "skipped").map((r) => r.page_id);
          for (let i = 0; i < skippedIds.length; i += 100) {
            const chunk = skippedIds.slice(i, i + 100);
            if (chunk.length) {
              await sb.from("hd_articles").update({ folder_id: folderId }).eq("source", "notion").in("source_id", chunk);
            }
          }
        }

        return json({
          ok: true,
          total: rows.length,
          pending: rows.filter((r) => r.status === "pending").length,
          skipped: rows.filter((r) => r.status === "skipped").length,
          folder: folderName,
        });
      }

      // ── Process one batch of pending pages: fetch → convert → upsert. Each
      //    page independent (one failure → mark failed + continue). ─────────
      case "runNotionSyncBatch": {
        const databaseId = String(body?.database_id || "").trim();
        if (!databaseId) return json({ error: "database_id required" }, 400);
        const batchSize = Math.min(Math.max(Number(body?.batch_size) || 6, 1), 15);
        const key = Deno.env.get("NOTION_API_KEY");
        if (!key) return json({ ok: false, message: "NOTION_API_KEY 未配置" });

        const { data: pend, error: pErr } = await sb
          .from("hd_sync_queue")
          .select("id, page_id, page_last_edited, folder_id")
          .eq("database_id", databaseId)
          .eq("status", "pending")
          .order("created_at")
          .limit(batchSize);
        if (pErr) throw pErr;

        let done = 0;
        let failed = 0;
        for (const row of pend || []) {
          try {
            const folderId = (row.folder_id as string | null) ?? null; // resolved at plan time
            const page = await getPage(key, row.page_id as string);
            const title = pageTitle(page) || "(无标题)";
            const content = await blocksToMarkdown(key, row.page_id as string, {
              persist: (u, bid) => persistMedia(sb, u, bid),
            });

            const { data: existed } = await sb
              .from("hd_articles")
              .select("id")
              .eq("source", "notion")
              .eq("source_id", row.page_id)
              .maybeSingle();
            if (existed?.id) {
              await sb
                .from("hd_articles")
                .update({ title, content, folder_id: folderId, notion_last_edited: row.page_last_edited })
                .eq("id", existed.id);
            } else {
              await sb.from("hd_articles").insert({
                title,
                content,
                source: "notion",
                source_id: row.page_id,
                folder_id: folderId,
                notion_last_edited: row.page_last_edited,
                category: "general",
              });
            }
            await sb.from("hd_sync_queue").update({ status: "done", error: null }).eq("id", row.id);
            done++;
          } catch (e) {
            await sb
              .from("hd_sync_queue")
              .update({ status: "failed", error: String(e instanceof Error ? e.message : e).slice(0, 500) })
              .eq("id", row.id);
            failed++;
          }
        }

        const { count: remaining } = await sb
          .from("hd_sync_queue")
          .select("id", { count: "exact", head: true })
          .eq("database_id", databaseId)
          .eq("status", "pending");
        const { count: total } = await sb
          .from("hd_sync_queue")
          .select("id", { count: "exact", head: true })
          .eq("database_id", databaseId);
        return json({ ok: true, batchDone: done, batchFailed: failed, remaining: remaining ?? 0, total: total ?? 0 });
      }

      case "getNotionSyncStatus": {
        const databaseId = String(body?.database_id || "").trim();
        if (!databaseId) return json({ error: "database_id required" }, 400);
        const counts: Record<string, number> = { pending: 0, done: 0, failed: 0, skipped: 0 };
        for (const s of Object.keys(counts)) {
          const { count } = await sb
            .from("hd_sync_queue")
            .select("id", { count: "exact", head: true })
            .eq("database_id", databaseId)
            .eq("status", s);
          counts[s] = count ?? 0;
        }
        return json({ ok: true, counts });
      }

      // ── Storage used by persisted Notion media (for quota monitoring) ────
      case "getStorageUsage": {
        let bytes = 0;
        let files = 0;
        let offset = 0;
        while (offset < 20000) {
          const { data, error } = await sb.storage
            .from("helpdesk-media")
            .list("notion", { limit: 100, offset });
          if (error) break;
          if (!data || data.length === 0) break;
          for (const o of data) bytes += (o.metadata?.size as number) || 0;
          files += data.length;
          if (data.length < 100) break;
          offset += 100;
        }
        return json({ ok: true, bytes, files });
      }

      // ── P7: Conversations list (most-recent first) ─────────────────────
      // Real visitor threads. Defaults to excluding the internal `admin-test`
      // channel (the AI-test page) unless includeTest / an explicit channel is
      // given. First user question + message count are computed from ONE
      // batched messages query (no N+1).
      case "listConversations": {
        const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 200);
        const channel = body?.channel ? String(body.channel) : "";
        const includeTest = !!body?.includeTest;
        const query = String(body?.query || "").trim();

        let q = sb
          .from("hd_conversations")
          .select("id, visitor_id, visitor_name, asker_email, asker_name, status, channel, location_id, created_at, updated_at")
          .order("updated_at", { ascending: false })
          .limit(limit);
        if (channel) q = q.eq("channel", channel);
        else if (!includeTest) q = q.neq("channel", "admin-test");
        if (query) {
          // Filter by visitor id OR the asking staff (email/name). Sanitised
          // against PostgREST or()-injection (strip commas/parens).
          const safe = query.replace(/[,()]/g, "").slice(0, 100);
          if (safe) q = q.or(`visitor_id.ilike.%${safe}%,asker_email.ilike.%${safe}%,asker_name.ilike.%${safe}%`);
        }
        const { data: convs, error } = await q;
        if (error) throw error;
        const list = convs || [];
        const ids = list.map((c) => c.id);

        const qById = new Map<string, string>();
        const countById = new Map<string, number>();
        if (ids.length) {
          const { data: msgs } = await sb
            .from("hd_messages")
            .select("conversation_id, role, content, created_at")
            .in("conversation_id", ids)
            .order("created_at");
          for (const m of msgs || []) {
            countById.set(m.conversation_id, (countById.get(m.conversation_id) || 0) + 1);
            if (m.role === "user" && !qById.has(m.conversation_id)) qById.set(m.conversation_id, m.content);
          }
        }

        const locIds = [...new Set(list.map((c) => c.location_id).filter(Boolean))];
        const nameByLoc: Record<string, string> = {};
        if (locIds.length) {
          const { data: locs } = await sb.from("ghl_locations").select("location_id, business_name").in("location_id", locIds);
          for (const l of locs || []) nameByLoc[l.location_id as string] = l.business_name as string;
        }

        const rows = list.map((c) => ({
          id: c.id,
          visitor_id: c.visitor_id,
          asker_email: c.asker_email ?? null,
          asker_name: c.asker_name ?? null,
          channel: c.channel,
          location_id: c.location_id,
          business_name: c.location_id ? nameByLoc[c.location_id] || null : null,
          status: c.status,
          created_at: c.created_at,
          updated_at: c.updated_at,
          question: qById.get(c.id) || null,
          messageCount: countById.get(c.id) || 0,
        }));
        return json({ conversations: rows });
      }

      // ── P7: One conversation thread + its 👍/👎 feedback ────────────────
      case "getConversation": {
        const id = String(body?.id || "").trim();
        if (!id) return json({ error: "id required" }, 400);
        const { data: conv, error } = await sb
          .from("hd_conversations")
          .select("id, visitor_id, visitor_name, asker_email, asker_name, status, channel, location_id, created_at, updated_at")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (!conv) return json({ error: "not_found" }, 404);
        const { data: messages } = await sb
          .from("hd_messages")
          .select("role, content, created_at")
          .eq("conversation_id", id)
          .order("created_at");
        const { data: feedback } = await sb
          .from("hd_message_feedback")
          .select("message_index, rating")
          .eq("conversation_id", id);
        let business_name: string | null = null;
        if (conv.location_id) {
          const { data: loc } = await sb
            .from("ghl_locations")
            .select("business_name")
            .eq("location_id", conv.location_id)
            .maybeSingle();
          business_name = (loc?.business_name as string) ?? null;
        }
        return json({ conversation: { ...conv, business_name }, messages: messages || [], feedback: feedback || [] });
      }

      // ── P7: Support analytics (standard; EXCLUDES admin-test) ───────────
      // PRE-SCALE TODO: channel/location/visitor breakdowns + the trend
      // aggregate from capped recent rows (2–3k) in the fn — move to SQL
      // group-by RPCs before high volume (same note as the RB/Admin stats).
      case "getSupportAnalytics": {
        const NOT_TEST = "admin-test";
        const count = (t: string) => sb.from(t).select("id", { count: "exact", head: true });

        const [convRes, qRes, aiRes, upRes, downRes] = await Promise.all([
          count("hd_conversations").neq("channel", NOT_TEST),
          count("hd_support_analytics"),
          count("hd_support_analytics").eq("ai_answered", true),
          count("hd_message_feedback").eq("rating", "up"),
          count("hd_message_feedback").eq("rating", "down"),
        ]);
        const conversations = convRes.count || 0;
        const questions = qRes.count || 0;
        const aiAnswered = aiRes.count || 0;
        const feedbackUp = upRes.count || 0;
        const feedbackDown = downRes.count || 0;

        const { data: convRows } = await sb
          .from("hd_conversations")
          .select("visitor_id, channel, location_id")
          .neq("channel", NOT_TEST)
          .order("created_at", { ascending: false })
          .limit(3000);
        const cr = convRows || [];
        const visitors = new Set(cr.map((c) => c.visitor_id)).size;
        const channelMap: Record<string, number> = {};
        const locCount: Record<string, number> = {};
        for (const c of cr) {
          channelMap[c.channel as string] = (channelMap[c.channel as string] || 0) + 1;
          if (c.location_id) locCount[c.location_id as string] = (locCount[c.location_id as string] || 0) + 1;
        }
        const byChannel = Object.entries(channelMap)
          .map(([channel, n]) => ({ channel, count: n }))
          .sort((a, b) => b.count - a.count);
        const topLocEntries = Object.entries(locCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const locIds = topLocEntries.map(([id]) => id);
        const nameByLoc: Record<string, string> = {};
        if (locIds.length) {
          const { data: locs } = await sb.from("ghl_locations").select("location_id, business_name").in("location_id", locIds);
          for (const l of locs || []) nameByLoc[l.location_id as string] = l.business_name as string;
        }
        const topLocations = topLocEntries.map(([id, n]) => ({
          location_id: id,
          business_name: nameByLoc[id] || null,
          count: n,
        }));

        const { data: qRows } = await sb
          .from("hd_support_analytics")
          .select("question, ai_answered, created_at")
          .order("created_at", { ascending: false })
          .limit(2000);
        const qr = qRows || [];
        const freq: Record<string, number> = {};
        for (const r of qr) {
          const key = (r.question || "").trim();
          if (key) freq[key] = (freq[key] || 0) + 1;
        }
        const topQuestions = Object.entries(freq)
          .map(([question, n]) => ({ question, count: n }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15);

        // 30-day questions-per-day trend.
        const buckets: Record<string, number> = {};
        const now = new Date();
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now);
          d.setUTCDate(d.getUTCDate() - i);
          buckets[d.toISOString().slice(0, 10)] = 0;
        }
        for (const r of qr) {
          const k = (r.created_at || "").slice(0, 10);
          if (k in buckets) buckets[k] += 1;
        }
        const trend = Object.entries(buckets).map(([date, n]) => ({ date, count: n }));

        return json({
          analytics: {
            totals: {
              conversations,
              questions,
              aiAnswered,
              aiAnsweredRate: questions ? aiAnswered / questions : 0,
              visitors,
              feedbackUp,
              feedbackDown,
            },
            byChannel,
            topLocations,
            topQuestions,
            trend,
          },
        });
      }

      // ── P8: Product updates (manual publish; newest first) ──────────────
      case "listUpdates": {
        const { data, error } = await sb
          .from("hd_updates")
          .select("id, title, description, category, image_url, link, created_at, updated_at")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json({ updates: data || [] });
      }

      case "saveUpdate": {
        const id = String(body?.id || "").trim();
        const title = String(body?.title || "").trim();
        if (!title) return json({ error: "title required" }, 400);
        const description = typeof body?.description === "string" ? body.description : "";
        const image_url = body?.image_url ? String(body.image_url).trim() : null;
        const link = body?.link ? String(body.link).trim() : null;
        if (id) {
          const { data, error } = await sb
            .from("hd_updates")
            .update({ title, description, image_url, link })
            .eq("id", id)
            .select("id")
            .single();
          if (error) throw error;
          return json({ ok: true, id: data.id });
        }
        const { data, error } = await sb
          .from("hd_updates")
          .insert({ title, description, image_url, link })
          .select("id")
          .single();
        if (error) throw error;
        return json({ ok: true, id: data.id });
      }

      case "deleteUpdate": {
        const id = String(body?.id || "").trim();
        if (!id) return json({ error: "id required" }, 400);
        const { error } = await sb.from("hd_updates").delete().eq("id", id);
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
