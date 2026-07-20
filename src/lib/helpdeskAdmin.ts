import { getSupabase } from "@/lib/supabase";

// Helpdesk admin data API — wraps the `helpdesk-admin` edge fn. functions.invoke
// auto-attaches the admin's session token; every action is re-verified
// server-side by requireAdmin (→ platform_admins allowlist). The frontend holds
// no privilege of its own and never touches hd_ tables directly.

async function callHelpdesk<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke("helpdesk-admin", { body: { action, ...payload } });
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

export type HelpdeskOverview = {
  counts: {
    articles: number;
    folders: number;
    conversations: number;
    faq: number;
    updates: number;
  };
  notion: { connected: boolean; databases: number };
};

/** Live overview counts for the shared help center. Admin-only (server-enforced). */
export async function getOverview(): Promise<HelpdeskOverview> {
  const { overview } = await callHelpdesk<{ overview: HelpdeskOverview }>("overview");
  return overview;
}

// ── Knowledge base (folders + articles) ─────────────────────────────────────

export type KBFolder = { id: string; name: string; icon: string | null; sort_order: number };

/** Article list row — no body (kept light for the list view). */
export type KBArticleListItem = {
  id: string;
  title: string;
  category: string;
  folder_id: string | null;
  source: string; // manual | notion
  source_id: string | null;
  sort_order: number;
  updated_at: string;
};

/** Full article incl. the markdown body (for the editor). */
export type KBArticle = {
  id: string;
  title: string;
  content: string;
  category: string;
  folder_id: string | null;
  source: string;
  source_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export async function listKnowledge(): Promise<{ folders: KBFolder[]; articles: KBArticleListItem[] }> {
  return callHelpdesk("listKnowledge");
}

export async function getArticle(id: string): Promise<KBArticle> {
  const { article } = await callHelpdesk<{ article: KBArticle }>("getArticle", { id });
  return article;
}

export async function saveArticle(payload: {
  id?: string;
  title: string;
  content: string;
  category?: string;
  folder_id?: string | null;
  sort_order?: number;
}): Promise<string> {
  const { id } = await callHelpdesk<{ id: string }>("saveArticle", payload);
  return id;
}

export async function deleteArticle(id: string): Promise<void> {
  await callHelpdesk("deleteArticle", { id });
}

export async function saveFolder(payload: {
  id?: string;
  name: string;
  icon?: string | null;
  sort_order?: number;
}): Promise<string> {
  const { id } = await callHelpdesk<{ id: string }>("saveFolder", payload);
  return id;
}

export async function deleteFolder(id: string): Promise<void> {
  await callHelpdesk("deleteFolder", { id });
}

// ── Notion (P4a: connection test only — imports nothing) ────────────────────

export type NotionTestResult = { ok: boolean; title?: string; pageCount?: number; message?: string };

/** Test a Notion database connection: returns its title + page count, or a
 *  handled failure message. Does NOT import anything. Admin-only. */
export async function testNotion(databaseId: string): Promise<NotionTestResult> {
  return callHelpdesk<NotionTestResult>("testNotion", { database_id: databaseId });
}
