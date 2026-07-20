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
}): Promise<ChatReply> {
  const { data, error } = await getSupabase().functions.invoke("helpdesk-chat", {
    body: {
      message: params.message,
      conversationId: params.conversationId ?? null,
      visitorId: params.visitorId,
      locationId: params.locationId ?? null,
      channel: params.channel ?? "web",
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
