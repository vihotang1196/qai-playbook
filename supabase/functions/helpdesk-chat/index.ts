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
import { requireAdmin } from "../_shared/admin.ts";
import { hasPlaybookAccess } from "../_shared/access.ts";
import { logToolUsage } from "../_shared/usage.ts";
import { checkRateLimit, locKey, rateLimitMessage, DAY_MS, HOUR_MS } from "../_shared/ratelimit.ts";

const MODEL = "claude-sonnet-4-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOOL_ROUNDS = 6;

// ── Abuse / cost protection (pre-launch) ──────────────────────────────────
// This endpoint is public and every question costs real money (up to 6 Claude
// rounds, and the context is bigger now that video steps are inlined), so it is
// the platform's largest cost exposure. Two gates, owner-approved:
//   1. IDENTITY — a location_id is REQUIRED. Previously it was optional
//      (analytics only), which meant a script could stay anonymous and spend
//      without limit. The /help UI already refuses to load without one, so this
//      only closes the direct-API hole. Signed-in ADMINS are exempt (the admin
//      "AI 测试" page sends no location_id).
//   2. RATE — per sub-account caps, counted in tool_usage. Normal support use is
//      a handful of questions per visit, so these are far above real usage.
// NO global cap (owner's call): one abuser must never lock out every customer.
const TOOL_KEY = "helpdesk";
const CHAT_LIMITS = [
  { windowMs: HOUR_MS, max: 150, label: "hour" },
  { windowMs: DAY_MS, max: 500, label: "day" },
];

/** Pick the reply language for our canned messages from the user's own text
 *  (the model handles language on its own for real answers). */
function langOf(text: string): "cn" | "en" {
  // Numeric code-point test (pure ASCII source) rather than a literal CJK
  // character class — same result, but immune to any encoding surprise in the
  // toolchain that edits/ships this file.
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x4e00 && c <= 0x9fff) return "cn"; // CJK Unified Ideographs
  }
  return "en";
}

/** A blocked request must look like a NORMAL assistant reply so the widget
 *  renders a friendly chat bubble — never a red error. Shape matches a real
 *  reply exactly, and carries no `error` field (the client throws on that). */
function friendlyReply(conversationId: string | null, answer: string) {
  return json({ conversationId, answer, sources: [] });
}

// Shown only on a GENUINE miss (the model read no article at all).
const NOT_FOUND_MSG =
  "抱歉，我在帮助中心里没找到相关内容。你可以换个说法再问，或联系我们的支持团队。";
// Conversation-record placeholder for the rare case where the model read an
// article but returned no prose. The API returns answer:"" for this case so the
// client can render a language-appropriate "open the guides below" line — we
// never pair the not-found message with source links.
const GUIDES_ONLY_RECORD = "（找到相关指南，请查看下方链接。）";

/**
 * How many past messages a conversation carries — BOTH into the model's context
 * and back into the widget on reload. These are deliberately one number: see the
 * note at the history query for why they must not diverge.
 */
const HISTORY_LIMIT = 20;

const SYSTEM_PROMPT = `You are "Angel AI", QAI's friendly help-center assistant. You help users by finding the right guide in the knowledge base and pointing them to it.

Use the tools:
- search_knowledge(query): find relevant articles (returns titles + short snippets). You may call it multiple times with different or translated keywords — most articles are written in English, so if the user asks in Chinese/Malay, also try English keywords.
- get_article(id): read an article's full text.

Workflow: search → read the most relevant article(s) → answer.

Your answer must:
1. Point the user to the single most relevant guide.
2. Give a SHORT summary of the steps (2–5 brief bullet points) based on the article's text.
3. Tell them to open the guide for the full details (screenshots / video).

VIDEO STEPS — important:
- Some articles contain a block marked 「[视频步骤 …（由视频内容整理，可直接告诉用户）]…[视频步骤结束]」. That is a FAITHFUL, pre-extracted text version of what the tutorial video actually shows and says.
- Treat it as normal, trustworthy article content: you MAY and SHOULD walk the user through those steps directly. This is NOT fabrication — it came from the video itself.
- When a guide has video steps, actually ANSWER the how-to (name the concrete buttons/fields in order, keeping their original English UI names), then add that the guide's video shows the same flow visually. Do NOT tell the user to "go watch the video" as the whole answer.
- Keep it digestible: summarise the key steps rather than dumping every line, unless the user asks for the full detail.
- A bare 「[视频]」 marker (no steps block) means that video was NOT transcribed — in that case fall back to the old behaviour: say the full walkthrough is in the guide's video.

Rules:
- Answer ONLY from the knowledge base. Do NOT invent steps that aren't in the articles.
- ALWAYS write at least one sentence of text — NEVER return an empty message. If you read/found a relevant guide, you MUST give the user a short text reply, even when the guide is mostly screenshots/video with little text. In that case, name the guide and say something like 「这篇指南主要是图文步骤，请打开《标题》查看完整操作。」("This guide is mostly step-by-step screenshots — open 《Title》 for the full walkthrough.") in the user's language. Never fabricate the visual steps, but never stay silent either.
- Many guides are mostly screenshots with little text — that's expected. Give what you can from the title and any text (including any 视频步骤 block), and clearly say the full step-by-step (with images/video) is in the linked article.
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

/** Storage object path — the key hd_video_steps rows are cached under. */
function storagePathFromUrl(url: string): string {
  const marker = "/helpdesk-media/";
  const i = url.indexOf(marker);
  const raw = i >= 0 ? url.slice(i + marker.length) : url;
  return decodeURIComponent(raw.split("?")[0]);
}

/** Cached video steps for one article, keyed by storage path. Only `done` rows
 *  are returned — a failed/pending video keeps the plain [视频] marker so the
 *  answer degrades to "open the guide and watch it" instead of going silent. */
// deno-lint-ignore no-explicit-any
async function videoStepsFor(sb: any, articleId: string): Promise<Record<string, string>> {
  const { data } = await sb
    .from("hd_video_steps")
    .select("storage_path, steps_text, status")
    .eq("article_id", articleId)
    .eq("status", "done");
  const map: Record<string, string> = {};
  for (const r of data || []) {
    const t = String(r.steps_text || "").trim();
    if (t) map[r.storage_path as string] = t;
  }
  return map;
}

/** Replace media markdown with short markers — the AI reads text, not images;
 *  this also keeps long Storage URLs out of the model's context.
 *
 *  Videos are the exception: when a cached transcript exists for that video
 *  (preprocessed once into hd_video_steps by a multimodal model), the marker is
 *  replaced by the actual step-by-step text, so the AI can TELL the user what
 *  the video shows instead of only linking to it. Without a cache hit it falls
 *  back to the bare [视频] marker exactly as before. */
function stripMedia(md: string, videoSteps?: Record<string, string>): string {
  return (md || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "[图片]")
    .replace(/\[📹([^\]]*)\]\(([^)]*)\)/g, (_m, caption: string, url: string) => {
      const steps = videoSteps?.[storagePathFromUrl(url)];
      if (!steps) return "[视频]";
      const label = (caption || "").trim();
      return `\n[视频步骤${label ? ` · ${label}` : ""}（由视频内容整理，可直接告诉用户）]\n${steps}\n[视频步骤结束]\n`;
    })
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

  // Also search the cached VIDEO STEPS. A guide can be almost pure video with a
  // near-empty body — invisible to the title/content search above — yet its
  // spoken/on-screen steps mention exactly what the user asked. Any article
  // matched this way is pulled into the candidate set (if not already there).
  const stepMatched = new Set<string>();
  const { data: vsRows } = await sb
    .from("hd_video_steps")
    .select("article_id")
    .eq("status", "done")
    .or(terms.map((t) => `steps_text.ilike.%${t}%`).join(","))
    .limit(40);
  for (const v of vsRows || []) stepMatched.add(v.article_id as string);

  const haveIds = new Set(cand.map((r: any) => r.id as string));
  const missing = [...stepMatched].filter((id) => !haveIds.has(id));
  if (missing.length) {
    const { data: extra } = await sb
      .from("hd_articles")
      .select("id, title, content, folder_id")
      .in("id", missing.slice(0, 20));
    for (const r of extra || []) cand.push(r);
  }
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
      // A hit inside the cached video steps is real evidence too — without this
      // a video-only guide (empty body) would always score 0 and never surface.
      if (stepMatched.has(r.id as string)) s += 2;
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
  // Inline any cached video steps for this article, so a video-only guide still
  // hands the model real instructions. Budget is larger than the old 6000 cap
  // because the steps are appended into the body.
  const steps = await videoStepsFor(sb, data.id as string);
  return {
    id: data.id,
    title: data.title,
    folder,
    content: stripMedia(data.content, steps).slice(0, 14000),
  };
}

// deno-lint-ignore no-explicit-any
async function runChat(
  sb: any,
  apiKey: string,
  history: any[],
  userMessage: string,
  answerLang?: "cn" | "en" | null,
) {
  // A forced answer language is APPENDED to the system prompt rather than baked
  // into it, so the default ("auto") path keeps the original prompt byte-for-byte
  // and its original behaviour.
  const system = answerLang
    ? SYSTEM_PROMPT +
      "\n\nLANGUAGE OVERRIDE: the user has explicitly chosen the answer language. " +
      "Reply ENTIRELY in " +
      (answerLang === "cn" ? "Chinese" : "English") +
      ", regardless of which language they wrote the question in. This overrides the " +
      "\"reply in the SAME language as the user's question\" rule above. Keep product / " +
      "UI names in their original form."
    : SYSTEM_PROMPT;
  const messages: any[] = [...history, { role: "user", content: userMessage }];
  const readIds: string[] = [];
  const titleById = new Map<string, string>();
  let answer = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1024, system, tools: TOOLS, messages }),
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
    const body = await req.json().catch(() => ({}));

    // ── Public 👍/👎 feedback write (widget) ─────────────────────────────
    // A separate, cheap action — no Claude call, no message. Idempotent per
    // (conversation, message_index): re-rating updates the existing row so a
    // visitor toggling 👍↔👎 never inflates the counts.
    if (body?.action === "feedback") {
      const conversationId = String(body?.conversationId || "").trim();
      const messageIndex = Number(body?.messageIndex);
      const rating = body?.rating === "up" ? "up" : body?.rating === "down" ? "down" : "";
      if (!conversationId || !Number.isFinite(messageIndex) || !rating) {
        return json({ error: "conversationId, messageIndex and rating required" }, 400);
      }
      const sbf = serviceClient();
      const excerpt = String(body?.excerpt || "").slice(0, 200) || null;
      const locationId = body?.locationId ? String(body.locationId) : null;
      const visitorId = String(body?.visitorId || "").trim() || null;
      const { data: existing } = await sbf
        .from("hd_message_feedback")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("message_index", messageIndex)
        .maybeSingle();
      if (existing) {
        await sbf
          .from("hd_message_feedback")
          .update({ rating, message_excerpt: excerpt, location_id: locationId, visitor_id: visitorId, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await sbf.from("hd_message_feedback").insert({
          conversation_id: conversationId,
          message_index: messageIndex,
          rating,
          message_excerpt: excerpt,
          location_id: locationId,
          visitor_id: visitorId,
        });
      }
      return json({ ok: true });
    }

    // ── Public history replay (widget) ────────────────────────────────────
    // Hands back the visitor's most recent conversation so a reload resumes the
    // thread instead of silently starting a new one. No Claude call.
    //
    // Scoped by BOTH visitor_id AND location_id, and that pairing is doing two
    // jobs. The obvious one is isolation: the same browser may have visited
    // several sub-accounts, and one sub-account's thread must not surface under
    // another. The second is defence in depth — visitor_id arrives from the
    // client, so it is effectively a bearer token, and requiring the matching
    // location_id means holding one of them alone is not enough.
    //
    // Not keyed on staff_email, deliberately. That value comes from a URL merge
    // field with no verification (see the helpdesk_asker migration: "never
    // auth"); keying private conversation content on it would let anyone read a
    // colleague's history by editing a query string. Threads stay device-bound.
    if (body?.action === "history") {
      const visitorId = String(body?.visitorId || "").trim();
      const locationId = String(body?.locationId || "").trim();
      if (!visitorId || !locationId) return json({ conversationId: null, messages: [] });

      const sbh = serviceClient();
      const { data: conv } = await sbh
        .from("hd_conversations")
        .select("id")
        .eq("visitor_id", visitorId)
        .eq("location_id", locationId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!conv) return json({ conversationId: null, messages: [] });

      // Newest-first then reversed, same as the model's slice above, so the two
      // stay in step: what the widget shows is what the model was given.
      const { data: msgs } = await sbh
        .from("hd_messages")
        .select("role, content, sources")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);
      const messages = (msgs || [])
        .slice()
        .reverse()
        .filter((m: any) => m.role === "user" || m.role === "assistant")
        .map((m: any) => ({
          role: m.role,
          content: m.content,
          sources: Array.isArray(m.sources) ? m.sources : [],
        }));
      return json({ conversationId: conv.id, messages });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

    const message = String(body?.message || "").trim();
    if (!message) return json({ error: "message required" }, 400);
    const channel = (String(body?.channel || "web").slice(0, 32)) || "web";
    const locationId = body?.locationId ? String(body.locationId) : null;
    const visitorId = String(body?.visitorId || "").trim() || `anon-${crypto.randomUUID().slice(0, 8)}`;
    // Need 2 — GHL staff who's asking (attribution; from the menu-link merge
    // fields, passed by the widget). Recorded on the conversation at creation.
    const askerEmail = body?.askerEmail ? String(body.askerEmail).trim().slice(0, 320) : null;
    const askerName = body?.askerName ? String(body.askerName).trim().slice(0, 200) : null;
    let conversationId = body?.conversationId ? String(body.conversationId) : null;

    const sb = serviceClient();
    const uiLang = langOf(message);

    // ── Gate 1: identity ──────────────────────────────────────────────────
    // No location_id → only a verified admin may proceed (the AI-test page).
    // requireAdmin validates the session JWT server-side; we deliberately do NOT
    // trust body.channel ("admin-test" is client-supplied and trivially forged).
    // The check runs ONLY on the no-location path, so normal customer traffic
    // never pays for the extra auth round-trip.
    let isAdminCaller = false;
    if (!locationId) {
      isAdminCaller = !!(await requireAdmin(req).catch(() => null));
      if (!isAdminCaller) {
        return friendlyReply(
          conversationId,
          uiLang === "cn"
            ? "请从你的 QAI 后台打开帮助中心，这样我才能识别你的账号来为你解答 🙏"
            : "Please open the help center from your QAI dashboard so I can recognise your account 🙏",
        );
      }
    }

    // ── Gate 1b: whitelist / per-account access ───────────────────────────
    // In canary mode only whitelisted sub-accounts may use the AI (admins always
    // can, via the req passed through). Friendly bubble, never a red error.
    if (locationId && !(await hasPlaybookAccess(sb, locationId, req))) {
      return friendlyReply(
        conversationId,
        uiLang === "cn"
          ? "帮助中心的 AI 问答尚未对你的账号开放，请联系 QAI 管理员开通 🙏"
          : "The AI help center isn't enabled for your account yet — please contact your QAI admin 🙏",
      );
    }

    // ── Gate 2: rate limit (per sub-account; admins exempt) ───────────────
    if (locationId) {
      const rl = await checkRateLimit(sb, {
        toolKey: TOOL_KEY,
        clientKey: locKey(locationId),
        windows: CHAT_LIMITS,
      });
      if (!rl.allowed) {
        return friendlyReply(
          conversationId,
          rateLimitMessage(uiLang, rl.limited?.label === "hour" ? "hour" : "day"),
        );
      }
    }

    // Resolve / create the conversation.
    if (!conversationId) {
      const { data, error } = await sb
        .from("hd_conversations")
        .insert({ visitor_id: visitorId, channel, location_id: locationId, status: "open", asker_email: askerEmail, asker_name: askerName })
        .select("id")
        .single();
      if (error) throw error;
      conversationId = data.id as string;
    }

    // Recent history (text turns only — tool rounds aren't replayed).
    //
    // DESCENDING + reverse, not ascending. `.order("created_at").limit(20)` takes
    // the OLDEST twenty, so on a long thread the model was fed the beginning of
    // the conversation and never the part the user just said. It went unnoticed
    // because conversations could not survive a refresh: they rarely reached
    // twenty messages, so "oldest 20" happened to be "all of them". Persisting
    // the conversation id is exactly what makes threads long enough for this to
    // bite, and the symptom would have been baffling — an assistant that recalls
    // the start of the chat but not the previous sentence.
    //
    // HISTORY_LIMIT is shared with the widget's own replay on purpose. If the UI
    // showed more turns than the model receives, a user could point at something
    // visible on their screen that the model cannot see, and the model would have
    // no way to know it was missing. Keep these two numbers equal.
    const { data: hist } = await sb
      .from("hd_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    const history = (hist || [])
      .slice()
      .reverse()
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({ role: m.role, content: m.content }));

    await sb.from("hd_messages").insert({ conversation_id: conversationId, role: "user", content: message });

    // Meter the attempt BEFORE the Claude call: the money is spent whether or
    // not the answer succeeds, and counting up-front also narrows the window in
    // which parallel requests could slip past the check above. Admin test
    // traffic is tagged but carries no client_key, so it is never counted
    // against a customer's quota.
    await logToolUsage(sb, {
      tool_key: TOOL_KEY,
      event_type: "chat",
      location_id: locationId,
      client_key: locationId ? locKey(locationId) : null,
      meta: { channel, admin: isAdminCaller || undefined },
    });

    // Customer-chosen answer language (independent of the site's UI language).
    // Anything other than cn/en means "auto" → detect from the question.
    const answerLang = body?.answerLang === "cn" || body?.answerLang === "en" ? body.answerLang : null;
    const { answer, sources } = await runChat(sb, apiKey, history, message, answerLang);
    const hasSources = sources.length > 0;
    // The model should always emit a short text answer when it read an article
    // (system prompt). If it still returns nothing but DID read article(s),
    // return an empty answer + the sources so the client renders a localized
    // "open the guides below" line — we never show "not found" next to source
    // links. Only a genuine miss (no sources read) gets the not-found message.
    const finalAnswer = answer || (hasSources ? "" : NOT_FOUND_MSG);
    // Always persist non-empty content for the conversation record / history.
    const recordedAnswer = finalAnswer || GUIDES_ONLY_RECORD;

    // `sources` is stored alongside the text so a replayed thread keeps its
    // guide buttons. Null when empty rather than [] — an older row and a genuine
    // no-sources answer then look identical to the widget, which is correct.
    await sb.from("hd_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: recordedAnswer,
      sources: hasSources ? sources : null,
    });
    await sb.from("hd_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    // Analytics: skip the internal AI-test channel so the admin dashboard shows
    // only real (web / widget) usage. Conversations are still recorded (and
    // filterable) regardless. Best-effort.
    if (channel !== "admin-test") {
      try {
        await sb.from("hd_support_analytics").insert({
          question: message,
          ai_answered: sources.length > 0,
          location_id: locationId,
        });
      } catch {
        /* analytics is best-effort */
      }
    }

    return json({ conversationId, answer: finalAnswer, sources });
  } catch (e) {
    console.error("helpdesk-chat error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
