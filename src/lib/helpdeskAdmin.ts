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

export type NotionDatabase = {
  id: string;
  title: string;
  url: string | null;
  pageCount: number;
  capped: boolean;
};

/** List every Notion database this integration can access (id + title + page
 *  count, most-articles first). Imports nothing. Admin-only. */
export async function listNotionDatabases(): Promise<{ ok: boolean; databases?: NotionDatabase[]; message?: string }> {
  return callHelpdesk("listNotionDatabases");
}

// ── Notion synced-database list + batched sync (P4b) ────────────────────────

export async function getNotionConfig(): Promise<string[]> {
  const { database_ids } = await callHelpdesk<{ database_ids: string[] }>("getNotionConfig");
  return database_ids || [];
}
export async function addNotionDatabase(id: string): Promise<string[]> {
  const { database_ids } = await callHelpdesk<{ database_ids: string[] }>("addNotionDatabase", { database_id: id });
  return database_ids || [];
}
export async function removeNotionDatabase(id: string): Promise<string[]> {
  const { database_ids } = await callHelpdesk<{ database_ids: string[] }>("removeNotionDatabase", { database_id: id });
  return database_ids || [];
}

export type SyncPlan = { ok: boolean; total?: number; pending?: number; skipped?: number; folder?: string; message?: string };
export type SyncBatch = {
  ok: boolean;
  batchDone?: number;
  batchFailed?: number;
  remaining?: number;
  total?: number;
  message?: string;
};

/** Plan a sync: (re)build the work-list, marking new/changed pages pending and
 *  unchanged ones skipped. `force` re-imports everything (e.g. to backfill media
 *  into articles imported before media support). Fast — no article bodies fetched. */
export async function planNotionSync(id: string, force = false): Promise<SyncPlan> {
  return callHelpdesk("planNotionSync", { database_id: id, force });
}
/** Process one batch of pending pages. Call repeatedly until remaining === 0.
 *  Small default batch — media download/upload makes each page slower. */
export async function runNotionSyncBatch(id: string, batchSize = 3): Promise<SyncBatch> {
  return callHelpdesk("runNotionSyncBatch", { database_id: id, batch_size: batchSize });
}

/** Bytes + file count of persisted Notion media in Storage (quota monitoring). */
export async function getStorageUsage(): Promise<{ bytes: number; files: number }> {
  const { bytes, files } = await callHelpdesk<{ bytes: number; files: number }>("getStorageUsage");
  return { bytes: bytes || 0, files: files || 0 };
}

// ── P7: Conversations + analytics (admin, requireAdmin-gated) ───────────────

export type ConversationRow = {
  id: string;
  visitor_id: string;
  asker_email: string | null; // GHL staff who asked (Need 2), null for pre-feature / anon
  asker_name: string | null;
  channel: string;
  location_id: string | null;
  business_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  question: string | null;
  messageCount: number;
};

export type ConversationMessage = { role: string; content: string; created_at: string };
export type ConversationFeedback = { message_index: number; rating: string };
export type ConversationDetail = {
  conversation: ConversationRow & { visitor_name: string | null };
  messages: ConversationMessage[];
  feedback: ConversationFeedback[];
};

/** Recent conversations, most-recent first. Excludes the internal `admin-test`
 *  channel unless includeTest / an explicit channel is passed. */
export async function listConversations(opts: {
  channel?: string;
  includeTest?: boolean;
  query?: string;
  limit?: number;
} = {}): Promise<ConversationRow[]> {
  const { conversations } = await callHelpdesk<{ conversations: ConversationRow[] }>("listConversations", opts);
  return conversations || [];
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  return callHelpdesk<ConversationDetail>("getConversation", { id });
}

export type SupportAnalytics = {
  totals: {
    conversations: number;
    questions: number;
    aiAnswered: number;
    aiAnsweredRate: number;
    visitors: number;
    feedbackUp: number;
    feedbackDown: number;
  };
  byChannel: { channel: string; count: number }[];
  topLocations: { location_id: string; business_name: string | null; count: number }[];
  topQuestions: { question: string; count: number }[];
  trend: { date: string; count: number }[];
};

export async function getSupportAnalytics(): Promise<SupportAnalytics> {
  const { analytics } = await callHelpdesk<{ analytics: SupportAnalytics }>("getSupportAnalytics");
  return analytics;
}

// ── P8: Product updates (admin, requireAdmin-gated) ─────────────────────────

export type HdUpdate = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  image_url: string | null;
  link: string | null;
  created_at: string;
  updated_at: string;
};

export async function listUpdates(): Promise<HdUpdate[]> {
  const { updates } = await callHelpdesk<{ updates: HdUpdate[] }>("listUpdates");
  return updates || [];
}

/** Create (no id) or update a product-update post. Publishes immediately. */
export async function saveUpdate(payload: {
  id?: string;
  title: string;
  description?: string;
  image_url?: string | null;
  link?: string | null;
}): Promise<string> {
  const { id } = await callHelpdesk<{ id: string }>("saveUpdate", payload);
  return id;
}

export async function deleteUpdate(id: string): Promise<void> {
  await callHelpdesk("deleteUpdate", { id });
}
