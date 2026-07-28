import { getSupabase } from "@/lib/supabase";

// Client for the PUBLIC helpdesk-chat edge fn (Angel AI). Used by the admin
// "AI 测试" page now and the P6 widget later. No admin auth — it's a public
// support chat; the server reads the KB with the service role.

export type ChatSource = { id: string; title: string };
export type ChatReply = { conversationId: string; answer: string; sources: ChatSource[] };

export async function sendChat(params: {
  message: string;
  conversationId?: string | null;
  visitorId?: string;
  locationId?: string | null;
  channel?: string;
  askerEmail?: string | null; // GHL staff who's asking (attribution; Need 2)
  askerName?: string | null;
  /** Force the AI to answer in this language. Null/omitted = detect it from the
   *  question (the original behaviour). Independent of the site's UI language. */
  answerLang?: "cn" | "en" | null;
}): Promise<ChatReply> {
  const { data, error } = await getSupabase().functions.invoke("helpdesk-chat", {
    body: {
      message: params.message,
      conversationId: params.conversationId ?? null,
      visitorId: params.visitorId,
      locationId: params.locationId ?? null,
      channel: params.channel ?? "web",
      askerEmail: params.askerEmail ?? null,
      askerName: params.askerName ?? null,
      answerLang: params.answerLang ?? null,
    },
  });
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
  const d = data as { conversationId: string; answer: string; sources?: ChatSource[] };
  return { conversationId: d.conversationId, answer: d.answer, sources: d.sources || [] };
}

/** Record a 👍/👎 on one AI answer. Idempotent per (conversation, messageIndex):
 *  re-rating updates the same row. Best-effort — the caller ignores failures. */
export async function sendFeedback(params: {
  conversationId: string;
  messageIndex: number;
  rating: "up" | "down";
  excerpt?: string;
  visitorId?: string;
  locationId?: string | null;
}): Promise<void> {
  const { error } = await getSupabase().functions.invoke("helpdesk-chat", {
    body: {
      action: "feedback",
      conversationId: params.conversationId,
      messageIndex: params.messageIndex,
      rating: params.rating,
      excerpt: params.excerpt,
      visitorId: params.visitorId,
      locationId: params.locationId ?? null,
    },
  });
  if (error) throw error;
}
