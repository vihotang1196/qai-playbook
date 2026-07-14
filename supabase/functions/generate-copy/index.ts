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

const MODEL = "claude-sonnet-4-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

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

任务：根据用户提供的产品 Survey，生成两大块内容，并以**纯 JSON** 返回（不要 markdown 代码块、不要任何解释、不要前后多余字符）。

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

**返回 JSON 结构（严格遵守 key 名称）：**
{
  "adScript": {
    "segments": [
      {"stage":"1. 注意 Attention","content":""},
      {"stage":"2. 兴趣 Interest","content":""},
      {"stage":"3. 欲望 Desire","content":""},
      {"stage":"4. 行动 Action","content":""},
      {"stage":"5. 广告上文 Top Banner","content":""},
      {"stage":"6. 广告下文 Bottom Banner","content":""}
    ]
  },
  "adCopy": "",
  "funnel": [
    {"section":"1. 标题 Headline","content":""},
    {"section":"2. 3大问题 3 Questions","content":""},
    {"section":"3. 共鸣 Empathy","content":""},
    {"section":"4. 3大痛点 3 Pain Points","content":""},
    {"section":"5. 3大好处 3 Benefits","content":""},
    {"section":"6. 前后对比 Before & After","content":""},
    {"section":"7. 自我介绍 About","content":""},
    {"section":"8. 3个见证 3 Testimonials","content":""},
    {"section":"9. 行动呼吁 Call to Action","content":""}
  ],
  "automationMessages": {
    "whatsapp": {
      "greeting": "",
      "dayBefore": "",
      "currentDay": ""
    },
    "email": {
      "greeting": { "subject": "", "body": "" },
      "dayBefore": { "subject": "", "body": "" },
      "currentDay": { "subject": "", "body": "" }
    }
  }
}`;

const SYSTEM_PROMPT_EN = `You are a senior direct-response copywriter for the Malaysian market, fluent in English with deep knowledge of WhatsApp DM selling culture and local idioms.

Task: Based on the provided product Survey, generate two blocks of content and return them as **pure JSON** (no markdown code fences, no explanation, no extra characters).

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

**Return JSON shape (strict key names):**
{
  "adScript": {
    "segments": [
      {"stage":"1. Attention","content":""},
      {"stage":"2. Interest","content":""},
      {"stage":"3. Desire","content":""},
      {"stage":"4. Action","content":""},
      {"stage":"5. Top Banner","content":""},
      {"stage":"6. Bottom Banner","content":""}
    ]
  },
  "adCopy": "",
  "funnel": [
    {"section":"1. Headline","content":""},
    {"section":"2. 3 Questions","content":""},
    {"section":"3. Empathy","content":""},
    {"section":"4. 3 Pain Points","content":""},
    {"section":"5. 3 Benefits","content":""},
    {"section":"6. Before & After","content":""},
    {"section":"7. About","content":""},
    {"section":"8. 3 Testimonials","content":""},
    {"section":"9. Call to Action","content":""}
  ],
  "automationMessages": {
    "whatsapp": {
      "greeting": "",
      "dayBefore": "",
      "currentDay": ""
    },
    "email": {
      "greeting": { "subject": "", "body": "" },
      "dayBefore": { "subject": "", "body": "" },
      "currentDay": { "subject": "", "body": "" }
    }
  }
}`;

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

请严格依照 system prompt 的 JSON 结构返回，且全部文字使用华文。`;
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

Follow the JSON schema strictly. ALL text must be in English.`;
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

/** Pull the JSON object out of the model's text: strip code fences, then take
 *  the outermost { ... } span. Mirrors the NurtureOS claude-chat approach. */
function extractJson(text: string): string {
  let t = text.trim();
  t = t
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    t = t.slice(first, last + 1);
  }
  return t;
}

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

  const system =
    lang === "ms" ? SYSTEM_PROMPT_MS : lang === "en" ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ZH;
  const user =
    lang === "ms"
      ? buildUserPromptMs(s)
      : lang === "en"
        ? buildUserPromptEn(s)
        : buildUserPromptZh(s);

  // Call Claude (non-streaming)
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
        max_tokens: 12000,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network error";
    return json({ error: `Failed to reach Claude: ${msg}` }, 502);
  }

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    if (res.status === 429) {
      return json(
        { error: lang === "en" ? "AI rate limit, please retry later" : "AI 请求过于频繁，请稍后再试" },
        429,
      );
    }
    if (res.status === 401) {
      return json({ error: "Invalid ANTHROPIC_API_KEY" }, 401);
    }
    if (res.status === 529) {
      return json(
        { error: lang === "en" ? "AI temporarily overloaded, please retry" : "AI 暂时繁忙，请稍后再试" },
        503,
      );
    }
    return json({ error: `Claude ${res.status}: ${detail}` }, 502);
  }

  // Extract text from the Claude response
  let modelText = "";
  try {
    const data = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    modelText = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("");
  } catch {
    return json({ error: lang === "en" ? "AI returned an unreadable response" : "AI 返回无法解析" }, 502);
  }

  if (!modelText.trim()) {
    return json({ error: lang === "en" ? "AI returned empty" : "AI 返回为空" }, 502);
  }

  // Parse the JSON payload
  let parsed: {
    adScript?: { segments?: Array<{ stage: string; content: string }> };
    adCopy?: unknown;
    funnel?: Array<{ section: string; content: string }>;
    automationMessages?: unknown;
  };
  try {
    parsed = JSON.parse(extractJson(modelText));
  } catch {
    return json({ error: lang === "en" ? "AI returned invalid format" : "AI 返回格式不正确" }, 502);
  }

  if (!parsed.adScript?.segments || !Array.isArray(parsed.funnel)) {
    return json(
      { error: lang === "en" ? "AI returned incomplete structure" : "AI 返回结构不完整" },
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
