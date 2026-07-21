// ════════════════════════════════════════════════════════════════════════
// Helpdesk AI chat ("Angel AI") — PUBLIC support chat over the shared KB.
//
// Claude Messages API (claude-sonnet-4-5, tool-use, NON-streaming). Two tools:
//   search_knowledge(query) — keyword search over hd_articles (title + body)
//   get_article(id)         — full article text (media stripped for the AI)
// The model finds the most relevant guide, gives a short step summary, and
// points the user to the article (which has the full screenshots/video). It
// answers ONLY from the KB and replies in the user's language.
//
// Anon-callable (verify_jwt off); runs with the service role internally to read
// hd_articles (RLS-locked) and log the conversation. Reused by the P6 widget.
// ANTHROPIC_API_KEY lives only as a Supabase Edge secret. NO vision — for
// image-heavy guides the AI locates them by title/text and links to the full
// article (owner's plain-text decision).
// ════════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, serviceClient } from "../_shared/ghl.ts";

const MODEL = "claude-sonnet-4-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOOL_ROUNDS = 6;

// Shown only on a GENUINE miss (the model read no article at all).
const NOT_FOUND_MSG =
  "抱歉，我在帮助中心里没找到相关内容。你可以换个说法再问，或联系我们的支持团队。";
// Conversation-record placeholder for the rare case where the model read an
// article but returned no prose. The API returns answer:"" for this case so the
// client can render a language-appropriate "open the guides below" line — we
// never pair the not-found message with source links.
const GUIDES_ONLY_RECORD = "（找到相关指南，请查看下方链接。）";

const SYSTEM_PROMPT = `You are "Angel AI", QAI's friendly help-center assistant. You help users by finding the right guide in the knowledge base and pointing them to it.

Use the tools:
- search_knowledge(query): find relevant articles (returns titles + short snippets). You may call it multiple times with different or translated keywords — most articles are written in English, so if the user asks in Chinese/Malay, also try English keywords.
- get_article(id): read an article's full text.

Workflow: search → read the most relevant article(s) → answer.

Your answer must:
1. Point the user to the single most relevant guide.
2. Give a SHORT summary of the steps (2–5 brief bullet points) based on the article's text.
3. Tell them to open the guide for the full details (screenshots / video).

Rules:
- Answer ONLY from the knowledge base. Do NOT invent steps that aren't in the articles.
- ALWAYS write at least one sentence of text — NEVER return an empty message. If you read/found a relevant guide, you MUST give the user a short text reply, even when the guide is mostly screenshots/video with little text. In that case, name the guide and say something like 「这篇指南主要是图文步骤，请打开《标题》查看完整操作。」("This guide is mostly step-by-step screenshots — open 《Title》 for the full walkthrough.") in the user's language. Never fabricate the visual steps, but never stay silent either.
- Many guides are mostly screenshots/video with little text — that's expected. Give what you can from the title and any text, and clearly say the full step-by-step (with images/video) is in the linked article.
- If nothing relevant is found, say so politely and suggest contacting the support team. Don't make up an answer.
- Reply in the SAME language as the user's question (Chinese / English / Malay).
- Be concise and friendly. Mention the guide you're pointing to BY NAME.
- Do NOT write any URL or markdown link yourself — you don't know the real URLs, and the app shows the clickable guide link separately below your answer. Refer to the guide by its title only (e.g. 「打开指南《标题》查看完整图文步骤」).`;

const TOOLS = [
  {
    name: "search_knowledge",
    description: "Search the help-center knowledge base for articles matching a query. Returns up to 8 candidates with title, folder, and a short snippet.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Keywords to search for (the user's question, or reformulated / translated keywords)." } },
      required: ["query"],
    },
  },
  {
    name: "get_article",
    description: "Read the full text of one knowledge-base article by its id (from search_knowledge results).",
    input_schema: {
      type: "object",
      properties: { id: { type: "string", description: "The article id." } },
      required: ["id"],
    },
  },
];

/** Replace media markdown with short markers — the AI reads text, not images;
 *  this also keeps long Storage URLs out of the model's context. */
function stripMedia(md: string): string {
  return (md || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "[图片]")
    .replace(/\[📹[^\]]*\]\([^)]*\)/g, "[视频]")
    .replace(/\[📎[^\]]*\]\([^)]*\)/g, "[附件]");
}

function snippetOf(md: string): string {
  const t = stripMedia(md).replace(/[#>*`_[\]]/g, " ").replace(/\s+/g, " ").trim();
  return t.slice(0, 200);
}

// deno-lint-ignore no-explicit-any
async function searchKnowledge(sb: any, query: string) {
  const q = (query || "").trim();
  if (!q) return [];
  const clean = (s: string) => s.replace(/[,()%*]/g, " ").trim();
  const terms = [...new Set([q, ...q.split(/\s+/)])].map(clean).filter((t) => t.length >= 2).slice(0, 8);
  if (!terms.length) return [];

  const ors: string[] = [];
  for (const t of terms) {
    ors.push(`title.ilike.%${t}%`);
    ors.push(`content.ilike.%${t}%`);
  }
  const { data: rows } = await sb
    .from("hd_articles")
    .select("id, title, content, folder_id")
    .or(ors.join(","))
    .limit(40);
  const cand = rows || [];
  if (!cand.length) return [];

  const fids = [...new Set(cand.map((r: any) => r.folder_id).filter(Boolean))];
  const fmap: Record<string, string> = {};
  if (fids.length) {
    const { data: fs } = await sb.from("hd_folders").select("id, name").in("id", fids);
    for (const f of fs || []) fmap[f.id as string] = f.name as string;
  }

  const ql = q.toLowerCase();
  const scored = cand
    .map((r: any) => {
      const tl = (r.title || "").toLowerCase();
      const cl = (r.content || "").toLowerCase();
      let s = 0;
      for (const t of terms) {
        const tt = t.toLowerCase();
        if (tl.includes(tt)) s += 3;
        if (cl.includes(tt)) s += 1;
      }
      if (tl.includes(ql)) s += 4;
      return { r, s };
    })
    .sort((a: any, b: any) => b.s - a.s)
    .slice(0, 8);

  return scored.map(({ r }: any) => ({
    id: r.id,
    title: r.title,
    folder: fmap[r.folder_id as string] || null,
    snippet: snippetOf(r.content),
  }));
}

// deno-lint-ignore no-explicit-any
async function getArticleForAI(sb: any, id: string) {
  const { data } = await sb.from("hd_articles").select("id, title, content, folder_id").eq("id", id).maybeSingle();
  if (!data) return null;
  let folder: string | null = null;
  if (data.folder_id) {
    const { data: f } = await sb.from("hd_folders").select("name").eq("id", data.folder_id).maybeSingle();
    folder = (f?.name as string) ?? null;
  }
  return { id: data.id, title: data.title, folder, content: stripMedia(data.content).slice(0, 6000) };
}

// deno-lint-ignore no-explicit-any
async function runChat(sb: any, apiKey: string, history: any[], userMessage: string) {
  const messages: any[] = [...history, { role: "user", content: userMessage }];
  const readIds: string[] = [];
  const titleById = new Map<string, string>();
  let answer = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: SYSTEM_PROMPT, tools: TOOLS, messages }),
    });
    if (!resp.ok) {
      const b = await resp.text().catch(() => "");
      throw new Error(`Claude API error [${resp.status}]: ${b.slice(0, 300)}`);
    }
    const data = await resp.json();
    const content = data.content || [];

    if (data.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content });
      const toolResults: any[] = [];
      for (const block of content) {
        if (block.type !== "tool_use") continue;
        let result: string;
        try {
          if (block.name === "search_knowledge") {
            const found = await searchKnowledge(sb, String(block.input?.query || ""));
            result = JSON.stringify({ articles: found });
          } else if (block.name === "get_article") {
            const art = await getArticleForAI(sb, String(block.input?.id || ""));
            if (art) {
              if (!titleById.has(art.id)) readIds.push(art.id);
              titleById.set(art.id, art.title);
              result = JSON.stringify(art);
            } else {
              result = JSON.stringify({ error: "not_found" });
            }
          } else {
            result = JSON.stringify({ error: "unknown tool" });
          }
        } catch (e) {
          result = JSON.stringify({ error: e instanceof Error ? e.message : "tool error" });
        }
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    answer = content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();
    break;
  }

  const sources = readIds.map((id) => ({ id, title: titleById.get(id) || "" }));
  return { answer, sources };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

    const body = await req.json().catch(() => ({}));
    const message = String(body?.message || "").trim();
    if (!message) return json({ error: "message required" }, 400);
    const channel = (String(body?.channel || "web").slice(0, 32)) || "web";
    const locationId = body?.locationId ? String(body.locationId) : null;
    const visitorId = String(body?.visitorId || "").trim() || `anon-${crypto.randomUUID().slice(0, 8)}`;
    let conversationId = body?.conversationId ? String(body.conversationId) : null;

    const sb = serviceClient();

    // Resolve / create the conversation.
    if (!conversationId) {
      const { data, error } = await sb
        .from("hd_conversations")
        .insert({ visitor_id: visitorId, channel, location_id: locationId, status: "open" })
        .select("id")
        .single();
      if (error) throw error;
      conversationId = data.id as string;
    }

    // Recent history (text turns only — tool rounds aren't replayed).
    const { data: hist } = await sb
      .from("hd_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at")
      .limit(20);
    const history = (hist || [])
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({ role: m.role, content: m.content }));

    await sb.from("hd_messages").insert({ conversation_id: conversationId, role: "user", content: message });

    const { answer, sources } = await runChat(sb, apiKey, history, message);
    const hasSources = sources.length > 0;
    // The model should always emit a short text answer when it read an article
    // (system prompt). If it still returns nothing but DID read article(s),
    // return an empty answer + the sources so the client renders a localized
    // "open the guides below" line — we never show "not found" next to source
    // links. Only a genuine miss (no sources read) gets the not-found message.
    const finalAnswer = answer || (hasSources ? "" : NOT_FOUND_MSG);
    // Always persist non-empty content for the conversation record / history.
    const recordedAnswer = finalAnswer || GUIDES_ONLY_RECORD;

    await sb.from("hd_messages").insert({ conversation_id: conversationId, role: "assistant", content: recordedAnswer });
    await sb.from("hd_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    try {
      await sb.from("hd_support_analytics").insert({
        question: message,
        ai_answered: sources.length > 0,
        location_id: locationId,
      });
    } catch {
      /* analytics is best-effort */
    }

    return json({ conversationId, answer: finalAnswer, sources });
  } catch (e) {
    console.error("helpdesk-chat error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
