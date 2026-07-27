// Supabase Edge Function (Deno) — QAI Ad & Funnel copy generator.
//
// Ported from the old TanStack Start server function. The prompts, output
// schema and validation are carried over verbatim; only the transport changed:
// the old code hit the Lovable gateway (Gemini, OpenAI-style JSON mode), this
// calls the Claude Messages API directly (matching the NurtureOS claude-chat
// pattern): api.anthropic.com/v1/messages, x-api-key, anthropic-version
// 2023-06-01, model claude-sonnet-4-5, non-streaming, regex-extract JSON.
//
// Secret required (set by the project owner, never in the frontend):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { serviceClient } from "../_shared/ghl.ts";
import { hasToolAccess } from "../_shared/access.ts";
import { logToolUsage } from "../_shared/usage.ts";
import { checkRateLimit, locKey, rateLimitMessage, DAY_MS, HOUR_MS } from "../_shared/ratelimit.ts";

const MODEL = "claude-sonnet-4-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Cost protection. max_tokens is 16000 here, so ONE generation is roughly
// US$0.25 — the priciest call in the platform. Owner-approved caps, per
// sub-account; no global cap (one abuser must not lock out everyone).
const TOOL_KEY = "copywriter";
const COPY_LIMITS = [
  { windowMs: HOUR_MS, max: 15, label: "hour" },
  { windowMs: DAY_MS, max: 40, label: "day" },
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Language = "zh" | "en" | "ms";

interface SurveyInput {
  language: Language;
  productName: string;
  productDesc: string;
  price: string;
  usp: string;
  ageRange: string;
  gender: string;
  occupation: string;
  painPoint: string;
  dream: string;
  testimonials: string;
  cta: string;
  tone: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompts (verbatim from the old generate.functions.ts)
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT_ZH = `你是马来西亚市场的资深广告/直效行销文案师，精通华文、WhatsApp 私讯销售文化与本地用语。

任务：根据用户提供的产品 Survey，生成以下内容，并**通过 emit_copy 工具**返回（工具的每个字段都要填满，不要留空；直接填入自然纯文本，需要换行就用 \n；不要在字段里放 JSON、代码块、HTML 标签或 markdown 语法）。

**输出语言：全部使用「华文（简体中文）」，不要任何英文段落或英文翻译。**

**本地化要求：**
- 价格一律使用 RM
- 语境贴近马来西亚消费者（WhatsApp 私讯文化、Shopee/Lazada、本地口语如 "lah / boleh / shiok" 适度点缀）

**广告脚本 adScript（严格 6 段，AIDA + 横幅）：**
- 第 1-4 段是 AIDA 广告口白文案，每段 content 为一整段口白（用来配音）
- 第 5 段「广告上文 Top Banner」：放在 16:9 或 1:1 影片上方空白处的吸睛大字短句（华文，<=20字）
- 第 6 段「广告下文 Bottom Banner」：放在影片下方空白处、点出核心承诺的短句（华文，<=20字）
- segments 的 stage 字段必须严格为：
  1. 注意 Attention
  2. 兴趣 Interest
  3. 欲望 Desire
  4. 行动 Action
  5. 广告上文 Top Banner
  6. 广告下文 Bottom Banner
- 每段只有 stage 与 content 两个字段

**广告文案 adCopy（社交贴文 Caption）：**
- 产出一段可直接发布的 FB/IG 广告贴文 caption，整段一个字串（含换行 \n 与适量 emoji）
- 结构：强力 hook 抓注意 → 点出痛点与渴望 → 介绍方案与核心好处 → 制造行动理由 → 结尾 CTA（呼应用户填写的行动呼吁：WhatsApp 私讯 / 报名 / 立即购买）
- 风格：马来西亚社交媒体口语、亲切、适量 emoji、换行分段方便阅读
- 必须与「影片脚本」「Funnel」内容互补，不要单纯复制重复
- 健康/医疗类不可虚假承诺疗效

**Funnel 9 段（单语言华文，每段只有 content 字段）：**
1. 标题 Headline — 一句大标题 + 一句副标
2. 3大问题 3 Questions — 必须用「1. ... / 2. ... / 3. ...」分三条列出
3. 共鸣 Empathy — 一整段文字
4. 3大痛点 3 Pain Points — 必须用「1. / 2. / 3.」分三条
5. 3大好处 3 Benefits — 必须用「1. / 2. / 3.」分三条
6. 前后对比 Before & After — 必须用两段「之前：...」与「之后：...」分行
7. 自我介绍 About — 一整段
8. 3个见证 3 Testimonials — 必须用「1. / 2. / 3.」分三条
9. 行动呼吁 Call to Action — 一段文字，结尾包含明确的行动指示

**合规：**
- 健康/医疗类禁止虚假疗效保证；改用个人经历/见证式语气。

**见证示范规则（重要）：**
- Funnel 第 8 段「3个见证」必须在内容最开头标注【示范见证，请替换为真实客户反馈】
- 示范要贴近真实客户口吻：具体场景、具体数字、口语化、有情绪，避免空泛套话。

**自动化跟进讯息 automationMessages（两种版本，各 3 封）：**
- 对象：报名/订阅/购买后的客户，做后续跟进与提醒。三封目的：greeting（立即发送欢迎/确认）、dayBefore（前一天提醒）、currentDay（当天提醒）。
- WhatsApp 版（automationMessages.whatsapp.greeting / dayBefore / currentDay）：纯字串。WhatsApp/即时通讯口吻，亲切、简短、适量 emoji、用 \n 换行分段方便手机阅读。
- Email 版（automationMessages.email.greeting / dayBefore / currentDay）：每封是 { "subject": "", "body": "" } 对象。
  - subject：吸睛、简洁、提高打开率（华文 <=20 字），可含 1 个 emoji。
  - body：比 WhatsApp 稍正式完整，但仍亲切易读，开头问候、清楚分段（\n\n）、结尾 CTA / 署名感。
- 两个版本三封内容方向一致但不可完全照抄：WhatsApp 更短促口语，Email 信息更完整。
- 三封都要呼应用户选的行动呼吁（WhatsApp 私讯 / 立即报名 / 立即购买），贴近马来西亚语境。
- 必须与「广告脚本」「广告文案」「Funnel」互补，不要单纯复制重复。
- 健康/医疗类不可虚假承诺疗效。

**字段对应（用 emit_copy 工具的对应字段，stage / section 名称必须与上面完全一致）：**
- adScript.segments：6 段，每段 { stage, content }
- adCopy：一段完整 caption 字串
- funnel：9 段，每段 { section, content }
- automationMessages.whatsapp.{greeting,dayBefore,currentDay}：字串
- automationMessages.email.{greeting,dayBefore,currentDay}：每封 { subject, body }

**极重要：adScript.segments 和 funnel 必须是真正的数组、automationMessages 必须是真正的对象，直接作为工具参数传入。绝对不要把它们变成字符串，也不要在里面塞 JSON 文本。**`;

const SYSTEM_PROMPT_EN = `You are a senior direct-response copywriter for the Malaysian market, fluent in English with deep knowledge of WhatsApp DM selling culture and local idioms.

Task: Based on the provided product Survey, generate the content below and return it by calling the **emit_copy tool** (fill every field, leave nothing blank; put natural plain text straight into each field, using \n for line breaks — do NOT put JSON, code blocks, HTML tags or markdown inside any field).

**Output language: ENGLISH ONLY. Do not include any Chinese.**

**Localization:**
- Use RM for all prices
- Match Malaysian consumer context (WhatsApp DM culture, Shopee/Lazada, lightly sprinkle local words like "lah / boleh / shiok" when natural)

**adScript (strict 6 segments, AIDA + banners):**
- Segments 1-4 are AIDA narration copy (used for voice-over); each "content" is one full narration paragraph.
- Segment 5 "Top Banner": catchy big-text line for the top whitespace of a 16:9 / 1:1 video (<=10 words).
- Segment 6 "Bottom Banner": core-promise line for the bottom whitespace (<=10 words).
- segments stage field MUST be exactly:
  1. Attention
  2. Interest
  3. Desire
  4. Action
  5. Top Banner
  6. Bottom Banner
- Each segment has only "stage" and "content".

**adCopy (social ad caption):**
- One ready-to-publish FB/IG ad post caption as a single string (with \n line breaks and tasteful emoji).
- Structure: strong hook → call out pain & desire → introduce solution & core benefits → urgency / reason to act now → final CTA matching the user's chosen call to action (WhatsApp DM / Sign up / Buy now).
- Style: conversational Malaysian social-media voice, friendly, tasteful emoji, line breaks for scannability.
- Must complement (NOT duplicate) the ad script and funnel content.
- No false health/medical claims.

**Funnel 9 sections (English only, each item has only a content field):**
1. Headline — one big headline + one subheadline
2. 3 Questions — MUST list as "1. ... / 2. ... / 3. ..."
3. Empathy — one paragraph
4. 3 Pain Points — MUST list as "1. / 2. / 3."
5. 3 Benefits — MUST list as "1. / 2. / 3."
6. Before & After — MUST be two lines: "Before: ..." and "After: ..."
7. About — one paragraph
8. 3 Testimonials — MUST list as "1. / 2. / 3."
9. Call to Action — one paragraph ending with a clear action directive

**Compliance:**
- No false health/medical claims; use personal-experience / testimonial tone.

**Testimonial sample rule (important):**
- Funnel section 8 ("3 Testimonials") MUST begin with the marker: [Sample testimonial — please replace with real customer feedback]
- Sample copy must sound real: specific scenes, specific numbers, conversational, emotional. Avoid generic praise.

**automationMessages (two formats, 3 messages each):**
- Audience: people who already signed up / subscribed / purchased — post-event follow-ups. Three roles: greeting (sent immediately), dayBefore (1 day before reminder), currentDay (day-of reminder).
- WhatsApp version (automationMessages.whatsapp.greeting / dayBefore / currentDay): plain strings. WhatsApp/IM voice, friendly, concise, tasteful emoji, \n line breaks for mobile.
- Email version (automationMessages.email.greeting / dayBefore / currentDay): each is a { "subject": "", "body": "" } object.
  - subject: catchy, concise, high open-rate (<=10 words), optionally 1 emoji.
  - body: slightly more formal/complete than WhatsApp but still warm and scannable, greeting line, clear paragraphs (\n\n), end with CTA / sign-off.
- Same intent across both formats but do NOT copy verbatim — WhatsApp shorter & punchier, Email more complete.
- All three messages must echo the user's chosen CTA (WhatsApp DM / Sign up / Buy now), Malaysian context.
- Complement (NOT duplicate) ad script, ad copy and funnel content.
- No false health/medical claims.

**Field mapping (use the emit_copy tool fields; stage / section names must match exactly as listed above):**
- adScript.segments: 6 items, each { stage, content }
- adCopy: one full caption string
- funnel: 9 items, each { section, content }
- automationMessages.whatsapp.{greeting,dayBefore,currentDay}: strings
- automationMessages.email.{greeting,dayBefore,currentDay}: each { subject, body }

**CRITICAL: adScript.segments and funnel MUST be real arrays, and automationMessages MUST be a real object, passed directly as tool arguments. NEVER return them as a string or as JSON text inside a field.**`;

const SYSTEM_PROMPT_MS = SYSTEM_PROMPT_EN.replace(
  "Output language: ENGLISH ONLY. Do not include any Chinese.",
  "Output language: BAHASA MALAYSIA (Malay) ONLY. Jangan campur Bahasa Inggeris atau Mandarin kecuali nama jenama / istilah teknikal.",
);

// ─────────────────────────────────────────────────────────────────────────────
// User prompt builders (verbatim)
// ─────────────────────────────────────────────────────────────────────────────

function buildUserPromptZh(s: SurveyInput): string {
  return `请根据以下产品资料生成广告脚本与 Funnel 文案：

【产品资料】
- 产品名称：${s.productName}
- 一句话描述：${s.productDesc}
- 价格/优惠：${s.price}
- 独特卖点：${s.usp}

【目标客户】
- 年龄段：${s.ageRange}
- 性别：${s.gender}
- 职业/身份：${s.occupation}
- 最大痛点：${s.painPoint}
- 最想要的结果/梦想：${s.dream}

【信任 & 行动】
- 现有见证或成果：${s.testimonials || "（未提供，请自拟马来西亚本地化范例）"}
- 行动呼吁方式：${s.cta}

【风格】
- 语气：${s.tone}

请通过 emit_copy 工具返回结果，且全部文字使用华文。`;
}

function buildUserPromptEn(s: SurveyInput): string {
  return `Generate the ad script and funnel copy from the following product survey:

[Product]
- Name: ${s.productName}
- One-line description: ${s.productDesc}
- Price / Offer: ${s.price}
- Unique selling points: ${s.usp}

[Target Customer]
- Age range: ${s.ageRange}
- Gender: ${s.gender}
- Occupation / Identity: ${s.occupation}
- Biggest pain point: ${s.painPoint}
- Dream outcome: ${s.dream}

[Trust & Action]
- Existing testimonials: ${s.testimonials || "(none provided — invent localized Malaysian samples)"}
- Call to action: ${s.cta}

[Style]
- Tone: ${s.tone}

Return your answer by calling the emit_copy tool. ALL text must be in English.`;
}

function buildUserPromptMs(s: SurveyInput): string {
  return buildUserPromptEn(s).replace(
    "ALL text must be in English.",
    "SEMUA teks mesti dalam Bahasa Malaysia.",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Escape raw control chars (newline/CR/tab) that appear INSIDE string literals,
 *  so a JSON string that used real line breaks becomes parseable. */
function sanitizeJsonControlChars(s: string): string {
  let out = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (esc) { out += ch; esc = false; continue; }
    if (ch === "\\") { out += ch; esc = true; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (inStr) {
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
    }
    out += ch;
  }
  return out;
}

// The tool Claude is forced to call. Using tool use (structured output) rather
// than parsing free-text JSON guarantees a schema-valid object — no markdown
// fences, unescaped quotes, newlines or stray HTML can break it.
const TOOL_NAME = "emit_copy";

const emailItemSchema = {
  type: "object",
  properties: { subject: { type: "string" }, body: { type: "string" } },
  required: ["subject", "body"],
};

const COPY_TOOL = {
  name: TOOL_NAME,
  description: "Return the generated ad script, ad caption, funnel copy and automation messages as structured data.",
  input_schema: {
    type: "object",
    properties: {
      adScript: {
        type: "object",
        properties: {
          segments: {
            type: "array",
            items: {
              type: "object",
              properties: { stage: { type: "string" }, content: { type: "string" } },
              required: ["stage", "content"],
            },
          },
        },
        required: ["segments"],
      },
      adCopy: { type: "string" },
      funnel: {
        type: "array",
        items: {
          type: "object",
          properties: { section: { type: "string" }, content: { type: "string" } },
          required: ["section", "content"],
        },
      },
      automationMessages: {
        type: "object",
        properties: {
          whatsapp: {
            type: "object",
            properties: {
              greeting: { type: "string" },
              dayBefore: { type: "string" },
              currentDay: { type: "string" },
            },
            required: ["greeting", "dayBefore", "currentDay"],
          },
          email: {
            type: "object",
            properties: {
              greeting: emailItemSchema,
              dayBefore: emailItemSchema,
              currentDay: emailItemSchema,
            },
            required: ["greeting", "dayBefore", "currentDay"],
          },
        },
        required: ["whatsapp", "email"],
      },
    },
    required: ["adScript", "adCopy", "funnel", "automationMessages"],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Parse + validate input
  let raw: Record<string, unknown>;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const lang: Language =
    raw.language === "en" || raw.language === "ms" ? raw.language : "zh";

  // ── Identity + access + rate limit (pre-launch cost protection) ─────────
  // This is the most expensive call in the platform (max_tokens 16000, roughly
  // US$0.25 a generation) and it used to be completely open: no identity, no
  // access check, no cap. All three are enforced here, BEFORE any Claude call,
  // so a refused request costs nothing. `code` is machine-readable so the client
  // knows these are hard "no"s and must not burn its retry budget on them.
  const locationId = String((raw.locationId as string) || (raw.location_id as string) || "").trim();
  if (!locationId) {
    return json(
      {
        error: lang === "en"
          ? "Please open the Copy Generator from your QAI dashboard so we can recognise your account."
          : "请从你的 QAI 后台打开文案生成器，这样才能识别你的账号。",
        code: "location_required",
      },
      400,
    );
  }

  const sb = serviceClient();
  if (!(await hasToolAccess(sb, locationId, TOOL_KEY, req))) {
    return json(
      {
        error: lang === "en"
          ? "The Copy Generator isn't enabled for your account yet. Please contact your QAI admin."
          : "文案生成器尚未对你的账号开放，请联系 QAI 管理员开通。",
        code: "tool_disabled",
      },
      403,
    );
  }

  const rl = await checkRateLimit(sb, {
    toolKey: TOOL_KEY,
    clientKey: locKey(locationId),
    windows: COPY_LIMITS,
    eventType: "generation",
  });
  if (!rl.allowed) {
    return json(
      {
        error: rateLimitMessage(lang === "zh" ? "cn" : "en", rl.limited?.label === "hour" ? "hour" : "day"),
        code: "quota_exceeded",
      },
      429,
    );
  }

  const s: SurveyInput = {
    language: lang,
    productName: asString(raw.productName),
    productDesc: asString(raw.productDesc),
    price: asString(raw.price),
    usp: asString(raw.usp),
    ageRange: asString(raw.ageRange),
    gender: asString(raw.gender),
    occupation: asString(raw.occupation),
    painPoint: asString(raw.painPoint),
    dream: asString(raw.dream),
    testimonials: asString(raw.testimonials),
    cta: asString(raw.cta),
    tone: asString(raw.tone),
  };

  if (!s.productName || !s.productDesc) {
    return json(
      { error: lang === "en" ? "Missing product details" : "缺少产品资料" },
      400,
    );
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json({ error: "Server misconfigured: ANTHROPIC_API_KEY not set" }, 500);
  }

  // Meter the attempt before spending: the cost lands whether or not the model
  // returns something usable, and counting up-front also narrows the window for
  // parallel requests to slip past the check above. NOTE the client retries a
  // malformed generation up to 3x, and each retry is metered — deliberate, since
  // each retry is a real Claude call.
  await logToolUsage(sb, {
    tool_key: TOOL_KEY,
    event_type: "generation",
    location_id: locationId,
    client_key: locKey(locationId),
    meta: { language: lang },
  });

  const system =
    lang === "ms" ? SYSTEM_PROMPT_MS : lang === "en" ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ZH;
  const user =
    lang === "ms"
      ? buildUserPromptMs(s)
      : lang === "en"
        ? buildUserPromptEn(s)
        : buildUserPromptZh(s);

  // Single Claude call (non-streaming). Edge Functions enforce a ~150s idle
  // limit, so we do NOT retry server-side — two sequential ~60s calls can blow
  // past it. The UI's "regenerate" button covers the rare transient failure.
  type Parsed = {
    adScript?: { segments?: Array<{ stage: string; content: string }> };
    adCopy?: unknown;
    funnel?: Array<{ section: string; content: string }>;
    automationMessages?: unknown;
  };

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        system,
        messages: [{ role: "user", content: user }],
        tools: [COPY_TOOL],
        tool_choice: { type: "tool", name: TOOL_NAME },
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network error";
    return json({ error: `Failed to reach Claude: ${msg}` }, 502);
  }

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    if (res.status === 401) return json({ error: "Invalid ANTHROPIC_API_KEY" }, 401);
    if (res.status === 429) {
      return json({ error: lang === "en" ? "AI rate limit, please retry later" : "AI 请求过于频繁，请稍后再试" }, 429);
    }
    if (res.status === 529) {
      return json({ error: lang === "en" ? "AI temporarily overloaded, please retry" : "AI 暂时繁忙，请稍后再试" }, 503);
    }
    return json({ error: `Claude ${res.status}: ${detail}` }, 502);
  }

  // Read the structured output straight from the forced tool call — no text
  // parsing, so quotes / newlines / HTML in the copy can't break anything.
  let parsed: Parsed = {};
  let stopReason = "";
  try {
    const data = (await res.json()) as {
      content?: Array<{ type?: string; name?: string; input?: unknown }>;
      stop_reason?: string;
    };
    stopReason = data.stop_reason ?? "";
    const block = (data.content ?? []).find(
      (b) => b.type === "tool_use" && b.name === TOOL_NAME,
    );
    if (block?.input && typeof block.input === "object") {
      parsed = block.input as Parsed;
    }
  } catch {
    return json({ error: lang === "en" ? "AI returned an unreadable response" : "AI 返回无法解析" }, 502);
  }

  // Claude's tool use occasionally returns a structured field as a JSON *string*
  // (e.g. funnel: "[{...}]") instead of a native array/object. Coerce those back.
  const reparse = (v: unknown): unknown => {
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v);
    } catch {
      try {
        return JSON.parse(sanitizeJsonControlChars(v));
      } catch {
        return v;
      }
    }
  };
  parsed.funnel = reparse(parsed.funnel) as Parsed["funnel"];
  parsed.adScript = reparse(parsed.adScript) as Parsed["adScript"];
  parsed.automationMessages = reparse(parsed.automationMessages);
  if (parsed.adScript && typeof parsed.adScript === "object") {
    parsed.adScript.segments = reparse(parsed.adScript.segments) as Parsed["adScript"]["segments"];
  }

  if (!parsed.adScript?.segments || !Array.isArray(parsed.funnel)) {
    const cutOff = stopReason === "max_tokens";
    return json(
      {
        error: cutOff
          ? (lang === "en" ? "AI response was cut off — please tap Regenerate" : "AI 输出被截断，请点「重新生成」")
          : (lang === "en" ? "AI returned incomplete output — please tap Regenerate" : "AI 返回不完整，请点「重新生成」"),
      },
      502,
    );
  }

  if (typeof parsed.adCopy !== "string") {
    parsed.adCopy = "";
  }

  // Normalize automationMessages defensively (mirrors the old server fn)
  const rawAm = (parsed.automationMessages ?? {}) as Record<string, unknown>;
  const wa = (rawAm.whatsapp ?? {}) as Record<string, unknown>;
  const em = (rawAm.email ?? {}) as Record<string, unknown>;
  const emailItem = (v: unknown) => {
    const o = (v ?? {}) as Record<string, unknown>;
    return { subject: asString(o.subject), body: asString(o.body) };
  };
  const automationMessages = {
    whatsapp: {
      greeting: asString(wa.greeting),
      dayBefore: asString(wa.dayBefore),
      currentDay: asString(wa.currentDay),
    },
    email: {
      greeting: emailItem(em.greeting),
      dayBefore: emailItem(em.dayBefore),
      currentDay: emailItem(em.currentDay),
    },
  };

  return json({
    language: lang,
    adScript: parsed.adScript,
    adCopy: parsed.adCopy,
    funnel: parsed.funnel,
    automationMessages,
  });
});
