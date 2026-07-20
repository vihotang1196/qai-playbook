import { getSupabase } from "@/lib/supabase";

// Client for the PUBLIC `helpdesk` edge fn — read-only access to the shared
// knowledge base for the customer help center (P6 widget). No auth: it's a
// public help center; the server reads the RLS-locked hd_ tables with the
// service role and exposes only reads. Writes go through helpdesk-admin.

async function callHelpdesk<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke("helpdesk", { body: { action, ...payload } });
  if (error) {
    let msg = error instanceof Error ? error.message : "请求失败";
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

export type HelpFolder = { id: string; name: string; icon: string | null; sort_order: number };

/** Article list row — no body (light for the browse list). */
export type HelpArticleListItem = {
  id: string;
  title: string;
  category: string;
  folder_id: string | null;
  sort_order: number;
  updated_at: string;
};

/** Full article incl. the markdown body (with permanent media URLs) for reading. */
export type HelpArticle = {
  id: string;
  title: string;
  content: string;
  category: string;
  folder_id: string | null;
  source: string;
  updated_at: string;
};

export async function listFolders(): Promise<HelpFolder[]> {
  const { folders } = await callHelpdesk<{ folders: HelpFolder[] }>("listFolders");
  return folders || [];
}

export async function listArticles(): Promise<HelpArticleListItem[]> {
  const { articles } = await callHelpdesk<{ articles: HelpArticleListItem[] }>("listArticles");
  return articles || [];
}

export async function getArticle(id: string): Promise<HelpArticle> {
  const { article } = await callHelpdesk<{ article: HelpArticle }>("getArticle", { id });
  return article;
}
