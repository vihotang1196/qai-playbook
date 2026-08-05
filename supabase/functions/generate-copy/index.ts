// Supabase Edge Function (Deno) — QAI Ad & Funnel copy generator.
//
// Ported from the old TanStack Start server function. The prompts, output
// schema and validation are carried over verbatim; only the transport changed:
// the old code hit the Lovable gateway (Gemini, OpenAI-style JSON mode), this
// calls the Claude Messages API directly (matching the NurtureOS claude-chat
// pattern): api.anthropic.com/v1/messages, x-api-key, anthropic-version
// 2023-06-01, non-streaming. Output arrives through a forced, strict tool call
// rather than the regex-extracted JSON this was ported with — see COPY_TOOL.
// The model is the MODEL constant below, which is also the rollback point.
//
// Secret required (set by the project owner, never in the frontend):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { serviceClient } from "../_shared/ghl.ts";
import { hasPlaybookAccess } from "../_shared/access.ts";
import { logToolUsage } from "../_shared/usage.ts";
import { checkRateLimit, locKey, rateLimitMessage, DAY_MS, HOUR_MS } from "../_shared/ratelimit.ts";

// Chosen for its copy tone, not its mechanics. Sonnet 5 was trialled on
// 2026-08-04 and measured better on every number — one attempt instead of three,
// $0.07 instead of $0.21, 69s instead of ~100s — because `strict: true` is
// honoured there and stops a field declared as an array from arriving as a
// string. The owner still chose 4-5, because the copy came back in a different
// voice: emoji 26 -> 4 in the caption, the 📍/✔️ bullet lists and the trailing
// hashtags gone, prose where the original had scannable blocks. That formatting
// is what the audience recognises, and no prompt tuning was worth risking it.
//
// The cost of that choice was three attempts per click and an hourly cap of 15
// that was really 5 generations. The server-side repair below is what brings that
// back down without touching the model or the prompt.
//
// TO RE-EVALUATE: change this one line back to "claude-sonnet-5". The strict
// schema is already written (see COPY_TOOL) and needs `strict: true` restored
// plus `thinking: {type: "disabled"}` on the request — Sonnet 5 thinks by
// default and thinking tokens share the max_tokens budget with the answer. Both
// were removed here rather than left in: whether 4-5 rejects them or ignores
// them is undocumented and was never tested, and an untested parameter on a live
// paid endpoint is not worth the bet.
const MODEL = "claude-sonnet-4-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Cost protection. The priciest call in the platform: ~US$0.10 per full
// generation, measured (2026-07-29, 4 calls, ~6.3k input + ~5.7k output tokens
// each). A malformed shape used to add another ~$0.10 per discarded attempt, up
// to ~$0.21 a click; the repair call re-emits only the broken field for roughly a
// third of that, so a repaired click should land near ~$0.13 — to be measured,
// not assumed. Only 'generation' rows count against these caps: a repair is
// metered separately, so a click the server fixed spends ONE slot, not three.
// max_tokens is 16000, so a worst case that ran to the cap would be ~US$0.25 —
// real generations land nowhere near it. Owner-approved caps, per sub-account;
// no global cap (one abuser must not lock out everyone).
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

/** Escape what JSON forbids inside a string but a model may still emit.
 *
 *  Two classes, both seen as unrecoverable parse failures on real output:
 *
 *  1. Control characters. JSON forbids EVERY codepoint below U+0020 inside a
 *     string. This used to escape three of them — newline, CR and tab — and
 *     passed the other 29 through untouched, so the retry parse failed with the
 *     same error as the first attempt and the field was written off as
 *     unrescuable. Covering 3 of 32 was never the intent, just the obvious
 *     three.
 *  2. Invalid escape sequences. A backslash is legal only before one of
 *     " \ / b f n r t u, and \u only before four hex digits. A literal
 *     backslash in the copy left the sequence intact and invalid, and the old
 *     code copied it verbatim by design.
 *
 *  Escaping is delegated to JSON.stringify on the single character, so the spec
 *  decides the form (newline becomes the two-character escape, U+000B becomes
 *  the \u form) and this file needs no hand-written backslash literals to get
 *  wrong. Character comparisons go through charCodeAt for the same reason. */
function sanitizeJsonControlChars(s: string): string {
  const BACKSLASH = 92;
  const QUOTE = 34;

  /** The exact escape JSON wants for this one character. */
  const escapeOf = (ch: string): string => JSON.stringify(ch).slice(1, -1);
  const isHex = (c: string | undefined): boolean =>
    c !== undefined && ((c >= "0" && c <= "9") || (c >= "a" && c <= "f") || (c >= "A" && c <= "F"));
  /** Escapes that need no argument beyond the character itself. */
  const isSimpleEscape = (c: string | undefined): boolean => {
    if (c === undefined) return false;
    const code = c.charCodeAt(0);
    return code === BACKSLASH || code === QUOTE || "bfnrt/".includes(c);
  };

  let out = "";
  let inStr = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const code = ch.charCodeAt(0);

    if (code === QUOTE) {
      inStr = !inStr;
      out += ch;
      continue;
    }

    if (code === BACKSLASH) {
      const next = s[i + 1];
      const validUnicode =
        next === "u" && isHex(s[i + 2]) && isHex(s[i + 3]) && isHex(s[i + 4]) && isHex(s[i + 5]);
      if (inStr && !isSimpleEscape(next) && !validUnicode) {
        // Not the start of a legal escape, so it is literal content.
        out += escapeOf(ch);
        continue;
      }
      // Legal escape (or a backslash outside a string, which this cannot fix):
      // copy it together with the character it escapes, so an escaped quote
      // cannot flip inStr.
      out += ch;
      if (next !== undefined) {
        out += next;
        i++;
      }
      continue;
    }

    if (inStr && code < 0x20) {
      out += escapeOf(ch);
      continue;
    }

    out += ch;
  }

  return out;
}
// The tool Claude is forced to call. Using tool use (structured output) rather
// than parsing free-text JSON guarantees a schema-valid object — no markdown
// fences, unescaped quotes, newlines or stray HTML can break it.
const TOOL_NAME = "emit_copy";

// `additionalProperties: false` appears on EVERY object below, including the
// nested ones — that is a hard precondition of `strict: true`, not a style
// choice, and a single object missing it makes the whole tool definition
// invalid. Same for `required`, which was already complete. If a field is added
// here later, it needs an entry in `required` and its own
// `additionalProperties: false` if it is an object.
const emailItemSchema = {
  type: "object",
  properties: { subject: { type: "string" }, body: { type: "string" } },
  required: ["subject", "body"],
  additionalProperties: false,
};

// Named so the repair tool can reuse the exact same definitions — a repair that
// asked for a subtly different shape than the original would defeat its purpose.
const SEGMENTS_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: { stage: { type: "string" }, content: { type: "string" } },
    required: ["stage", "content"],
    additionalProperties: false,
  },
};

const FUNNEL_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: { section: { type: "string" }, content: { type: "string" } },
    required: ["section", "content"],
    additionalProperties: false,
  },
};

const COPY_TOOL = {
  name: TOOL_NAME,
  description: "Return the generated ad script, ad caption, funnel copy and automation messages as structured data.",
  // NOTE: `strict: true` belongs here, as a sibling of `name` — that is what
  // makes the API validate `input` against the schema before returning, so a
  // field declared as an array cannot arrive as a string. It is deliberately
  // absent while MODEL is claude-sonnet-4-5: strict mode is honoured only on
  // Sonnet 5 / Opus 4.8+ / Haiku 4.5, and whether an older model rejects the
  // flag or ignores it is undocumented and untested. Restore it together with
  // the model — see the note by MODEL.
  input_schema: {
    type: "object",
    properties: {
      adScript: {
        type: "object",
        properties: { segments: SEGMENTS_SCHEMA },
        required: ["segments"],
        additionalProperties: false,
      },
      adCopy: { type: "string" },
      funnel: FUNNEL_SCHEMA,
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
            additionalProperties: false,
          },
          email: {
            type: "object",
            properties: {
              greeting: emailItemSchema,
              dayBefore: emailItemSchema,
              currentDay: emailItemSchema,
            },
            required: ["greeting", "dayBefore", "currentDay"],
            additionalProperties: false,
          },
        },
        required: ["whatsapp", "email"],
        additionalProperties: false,
      },
    },
    required: ["adScript", "adCopy", "funnel", "automationMessages"],
    additionalProperties: false,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Repair: re-emit one bad field instead of regenerating everything
// ─────────────────────────────────────────────────────────────────────────────
// The observed failure is narrow. On 2026-08-04 a real failure had
// stop_reason "tool_use", 4,484 output tokens, `segments` complete with all 6
// items, and `funnel` delivered as a plain string the coercion could not rescue.
// One field out of four, with everything else usable.
//
// Returning 502 there threw away a whole paid generation and made the client
// regenerate from scratch — three attempts a click at the observed rate, ~$0.21,
// and three quota slots against an hourly cap of 15, so a customer really only
// got 5 generations an hour and read the lockout as the tool being broken.
//
// A repair call asks only for the broken field, passing the copy that DID arrive
// as context so the voice matches, and costs roughly a third of a full
// generation. It runs server-side, so a successful repair is invisible to the
// client: one request, one success, one quota slot.
//
// Exactly ONE attempt, deliberately. A retry loop here would re-create the
// problem this removes, and the client still has its own retries as the last
// resort if the repair also fails.

const REPAIR_TOOL_NAME = "emit_repair";

// How long the original generation may have taken and still leave room for a
// repair. Edge Functions cut off around 150s; observed generations run 69-108s
// and a repair should add 20-40s, so 90s + 40s = 130s is already close.
//
// Skipping past this point is NOT a lost opportunity, it avoids a worse outcome.
// `generation_result` is written AFTER the repair, so a repair killed mid-flight
// leaves NO row at all — recovery has nothing to hand back, the client sees a
// dead connection, and it regenerates from scratch. That costs more than never
// attempting the repair. Over budget, the right move is to fail the way this
// function failed before repairs existed.
const REPAIR_TIME_BUDGET_MS = 90_000;

type RepairField = "funnel" | "segments";

/** The same field definitions as COPY_TOOL, narrowed to the unusable ones — a
 *  repair that asked for a subtly different shape would defeat its own purpose. */
function buildRepairTool(fields: RepairField[]) {
  const properties: Record<string, unknown> = {};
  if (fields.includes("funnel")) properties.funnel = FUNNEL_SCHEMA;
  if (fields.includes("segments")) properties.segments = SEGMENTS_SCHEMA;
  return {
    name: REPAIR_TOOL_NAME,
    description: "Re-emit only the listed fields, in the correct structure.",
    input_schema: {
      type: "object",
      properties,
      required: fields,
      additionalProperties: false,
    },
  };
}

/** Context + instructions for the repair. The ORIGINAL system prompt is reused
 *  unchanged, so every style rule (emoji, local flavour, section names, tone)
 *  still applies — this only says which field to re-emit and shows the copy it
 *  has to sit alongside. Naming the sections is left to the system prompt rather
 *  than restated here, so the two can't drift apart. */
function buildRepairPrompt(
  lang: Language,
  fields: RepairField[],
  kept: { adCopy: string; funnel?: unknown; segments?: unknown },
): string {
  const wanted = {
    zh: {
      funnel: "funnel：9 段，每段 { section, content }。section 名称与顺序必须与系统提示列出的 9 段完全一致。",
      segments: "segments：6 段，每段 { stage, content }。stage 名称与顺序必须与系统提示列出的 6 段完全一致。",
      head: "上一次生成的大部分内容是好的，只有以下字段结构不合格，需要你只重新产出这些字段：",
      ctx: "【已产出的内容 — 语气、emoji 用量、本地口语、行文节奏都要与这些保持一致，但不要照抄句子】",
      tail: "只通过 emit_repair 工具输出上面列出的字段，不要输出其他字段，也不要任何解释文字。字段必须是真正的数组，绝对不要写成字符串或 JSON 文本。",
    },
    en: {
      funnel: "funnel: 9 entries, each { section, content }. Section names and order must match the 9 listed in the system prompt exactly.",
      segments: "segments: 6 entries, each { stage, content }. Stage names and order must match the 6 listed in the system prompt exactly.",
      head: "Most of the previous generation is good. Only these fields came back in an unusable structure — re-emit just these:",
      ctx: "[Already produced — match its tone, emoji density, local flavour and rhythm, but do not reuse its sentences]",
      tail: "Return only the listed fields through the emit_repair tool. No other fields, no explanation. They must be real arrays, never strings or JSON text.",
    },
    ms: {
      funnel: "funnel: 9 bahagian, setiap satu { section, content }. Nama dan susunan section mesti sama tepat dengan 9 yang disenaraikan dalam system prompt.",
      segments: "segments: 6 bahagian, setiap satu { stage, content }. Nama dan susunan stage mesti sama tepat dengan 6 yang disenaraikan dalam system prompt.",
      head: "Sebahagian besar hasil sebelum ini sudah betul. Hanya medan berikut yang strukturnya tidak sah — hasilkan semula medan ini sahaja:",
      ctx: "[Sudah dihasilkan — kekalkan nada, kekerapan emoji, laras tempatan dan rentaknya, tetapi jangan salin ayatnya]",
      tail: "Kembalikan hanya medan yang disenaraikan melalui alat emit_repair. Tiada medan lain, tiada penjelasan. Ia mesti array sebenar, bukan string atau teks JSON.",
    },
  }[lang];

  // Only what actually arrived. A truncated generation can leave adCopy empty,
  // and an empty heading in the context reads as "this field is meant to be
  // blank" rather than "it is missing".
  const ctx: string[] = [];
  if (kept.adCopy) ctx.push(`adCopy:\n${kept.adCopy}`);
  if (kept.segments) ctx.push(`segments:\n${JSON.stringify(kept.segments, null, 1)}`);
  if (kept.funnel) ctx.push(`funnel:\n${JSON.stringify(kept.funnel, null, 1)}`);

  return [
    wanted.head,
    ...fields.map((f) => `- ${wanted[f]}`),
    "",
    wanted.ctx,
    ...ctx,
    "",
    wanted.tail,
  ].join("\n");
}

type RepairOutcome = {
  funnel?: unknown;
  segments?: unknown;
  inputTokens: number | null;
  outputTokens: number | null;
  stopReason: string;
};

/** One repair call. Returns null on any failure — a bad HTTP status, an
 *  unreadable body, or a missing tool_use block. The caller validates the shape
 *  of whatever comes back, exactly as it validates the original. */
async function repairFields(
  apiKey: string,
  system: string,
  lang: Language,
  fields: RepairField[],
  kept: { adCopy: string; funnel?: unknown; segments?: unknown },
): Promise<RepairOutcome | null> {
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
        // One or two array fields, not a whole generation. Generous headroom is
        // free — unused output tokens are not billed.
        max_tokens: 8000,
        system,
        messages: [{ role: "user", content: buildRepairPrompt(lang, fields, kept) }],
        tools: [buildRepairTool(fields)],
        tool_choice: { type: "tool", name: REPAIR_TOOL_NAME },
      }),
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  try {
    const data = (await res.json()) as {
      content?: Array<{ type?: string; name?: string; input?: unknown }>;
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const block = (data.content ?? []).find(
      (b) => b.type === "tool_use" && b.name === REPAIR_TOOL_NAME,
    );
    if (!block?.input || typeof block.input !== "object") return null;
    const input = block.input as Record<string, unknown>;
    return {
      funnel: input.funnel,
      segments: input.segments,
      inputTokens: data.usage?.input_tokens ?? null,
      outputTokens: data.usage?.output_tokens ?? null,
      stopReason: data.stop_reason ?? "",
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Clock for REPAIR_TIME_BUDGET_MS. Started at the top rather than at the Claude
  // call because the Edge cut-off applies to the whole invocation, not just the
  // model request — the access check and the metering write count against it too.
  const startedAt = Date.now();

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
  // This is the most expensive call in the platform (~US$0.10-0.14 a
  // generation — see the note by COPY_LIMITS) and it used to be completely open:
  // no identity, no access check, no cap. All three are enforced here, BEFORE
  // any Claude call, so a refused request costs nothing. `code` is
  // machine-readable so the client knows these are hard "no"s and must not burn
  // its retry budget on them.
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
  if (!(await hasPlaybookAccess(sb, locationId, req))) {
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

  // A browser-scoped id for one generation attempt, minted by the client. It is
  // the ONLY key the recovery lookup matches on — deliberately not location_id,
  // which is the SUB-ACCOUNT and is shared by everyone working under that
  // client. Keyed on location alone, "the newest result here" would hand one
  // person the product name, pricing and USP another person just typed in.
  const requestId = String((raw.requestId as string) || "").trim();

  // ── Recovery: hand back a finished generation the browser never received ──
  // The generation costs real money and runs ~2 minutes. If the customer
  // refreshes, switches tabs, or loses signal mid-flight, the fetch dies but the
  // function keeps running server-side to completion and Anthropic still bills
  // it. Without somewhere to put the answer, that spend buys nothing and the
  // customer pays again. This reads back the row written at the end of a
  // successful run.
  //
  // Costs nothing and is metered nothing: no Claude call, no rate-limit spend.
  // It sits after the access check on purpose — a stranger must not be able to
  // read a result by guessing an id — and before the rate limiter, because being
  // out of generation quota is exactly when you most need the one you paid for.
  if (raw.action === "recover") {
    if (!requestId) return json({ error: "requestId required", code: "request_id_required" }, 400);
    const { data } = await sb
      .from("tool_usage")
      .select("meta, created_at")
      .eq("tool_key", TOOL_KEY)
      .eq("event_type", "generation_result")
      .eq("location_id", locationId)
      .contains("meta", { requestId })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const result = (data?.meta as { result?: unknown } | null)?.result ?? null;
    return json({ result, createdAt: data?.created_at ?? null });
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
  //
  // requestId is carried here purely so those retries can be grouped back into
  // the ONE click that spawned them: the client reuses a single requestId across
  // its whole retry loop, so without it three rows an hour apart and three rows
  // from one click look identical in the meter.
  await logToolUsage(sb, {
    tool_key: TOOL_KEY,
    event_type: "generation",
    location_id: locationId,
    client_key: locKey(locationId),
    meta: { language: lang, requestId: requestId || null },
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

  // ── Diagnostics for a paid-but-failed attempt ───────────────────────────────
  // Every failure exit from here down has already been metered and has already
  // paid for a real Claude call, and none of them used to leave a trace: this
  // function had no logging at all and never read the response's `usage`, so
  // "why did it fail, and what did that cost" was unanswerable afterwards. That
  // is what made a customer report of 3 calls per click impossible to diagnose.
  //
  // Its own event_type, so it stays out of both the quota and the stats:
  // checkRateLimit for this tool counts only 'generation' (see the call above),
  // and the admin overview counts only 'generation' / 'posted'. Carries NO
  // client_key either — the other dimension the limiter can count on.
  //
  // Shapes and types only, never the copy or the customer's product details:
  // this row exists to explain a failure, not to store content.
  const failMeta: Record<string, unknown> = {};
  const logFailure = (reason: string) =>
    logToolUsage(sb, {
      tool_key: TOOL_KEY,
      event_type: "generation_failed",
      location_id: locationId,
      meta: { language: lang, requestId: requestId || null, reason, ...failMeta },
    });

  /** A value's type at a glance, for the before/after reparse record. */
  const shapeOf = (v: unknown): string =>
    Array.isArray(v) ? `array(${v.length})` : v === null ? "null" : typeof v;

  /** The first 120 characters of what actually arrived in a broken field. If a
   *  failure turns out to be valid JSON wrapped in a ```json fence, or an array
   *  with a stray prefix, the coercion above can be taught to strip it and the
   *  repair call becomes unnecessary — the cheapest possible fix. Marketing copy,
   *  not customer data, and capped so a row cannot grow unbounded. */
  const previewOf = (v: unknown): string =>
    (typeof v === "string" ? v : v === undefined ? "(undefined)" : JSON.stringify(v) ?? "(null)")
      .slice(0, 120);

  /** One step deeper than shapeOf: "array(9) of object" vs "array(2) of string"
   *  is what tells a missing field apart from a wrongly-shaped one. */
  const describeItems = (v: unknown): string => {
    if (!Array.isArray(v)) return shapeOf(v);
    if (v.length === 0) return "array(0)";
    return `array(${v.length}) of ${[...new Set(v.map(shapeOf))].join("|")}`;
  };

  /** Every item is an object carrying a non-empty string at each of `keys`.
   *
   *  Checking Array.isArray alone was not enough. A shape like
   *  ["Section one", "Section two"] — a real array, wrong items — passed the
   *  coercion above, passed validation, was billed in full, and then rendered as
   *  blank cards, because Results reads `.section` / `.content` off each item.
   *  An empty array behaved the same way. The customer saw an empty page rather
   *  than an error, which is the worst of the three outcomes: they can't tell it
   *  failed, so they don't press Regenerate, and the spend buys nothing.
   *
   *  Empty strings count as missing for the same reason — a section whose content
   *  is "" renders as nothing, so accepting it would preserve exactly the silent
   *  blank this check exists to remove. */
  const itemsHaveKeys = (v: unknown, keys: string[]): boolean =>
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const o = item as Record<string, unknown>;
      return keys.every((k) => typeof o[k] === "string" && (o[k] as string).trim() !== "");
    });

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
    failMeta.detail = msg.slice(0, 200);
    await logFailure("fetch_failed");
    return json({ error: `Failed to reach Claude: ${msg}` }, 502);
  }

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    // Logged once, before the branching: which status it was is the diagnosis.
    failMeta.httpStatus = res.status;
    failMeta.detail = detail;
    await logFailure("upstream_error");
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
  // What the call cost, recorded on BOTH outcomes — the failure row to explain a
  // wasted attempt, the result row so a SUCCESSFUL generation's spend is
  // auditable too. The first version of this only wrote it on failure, which
  // left "what does one generation actually cost" answerable only from the
  // Anthropic console, and only in daily aggregate.
  let spend: {
    stopReason: string;
    inputTokens: number | null;
    outputTokens: number | null;
  } = { stopReason: "", inputTokens: null, outputTokens: null };
  try {
    const data = (await res.json()) as {
      content?: Array<{ type?: string; name?: string; input?: unknown }>;
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    stopReason = data.stop_reason ?? "";
    // Read on every path, failed or not. Comparing output_tokens against
    // max_tokens is what separates "the model was cut off mid-answer" from "the
    // model finished and sent a bad shape", and on the happy path it is the only
    // record of what the generation cost.
    spend = {
      stopReason,
      inputTokens: data.usage?.input_tokens ?? null,
      outputTokens: data.usage?.output_tokens ?? null,
    };
    Object.assign(failMeta, spend);
    const block = (data.content ?? []).find(
      (b) => b.type === "tool_use" && b.name === TOOL_NAME,
    );
    if (block?.input && typeof block.input === "object") {
      parsed = block.input as Parsed;
    } else {
      // A forced tool_choice makes this near-impossible; record it if it happens.
      failMeta.toolUseBlock = "missing";
    }
  } catch {
    failMeta.httpStatus = res.status;
    await logFailure("unreadable_response");
    return json({ error: lang === "en" ? "AI returned an unreadable response" : "AI 返回无法解析" }, 502);
  }

  // Claude's tool use occasionally returns a structured field as a JSON *string*
  // (e.g. funnel: "[{...}]") instead of a native array/object. Coerce those back.
  // Why a coercion failed, per field. Both parse attempts are reported, because
  // the difference between them is the diagnosis: if the raw attempt fails on a
  // control character and the sanitized attempt fails on something else, the
  // sanitizer helped but did not go far enough; if both fail at the very end of
  // the string, the model never finished writing it and no parser can help.
  const parseFailures: Record<string, unknown> = {};

  const reparse = (v: unknown, name?: string): unknown => {
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v);
    } catch (rawErr) {
      try {
        return JSON.parse(sanitizeJsonControlChars(v));
      } catch (sanitizedErr) {
        if (name) {
          parseFailures[name] = {
            brokenLength: v.length,
            brokenTail: v.slice(-120),
            parseError: rawErr instanceof Error ? rawErr.message : String(rawErr),
            parseErrorAfterSanitize:
              sanitizedErr instanceof Error ? sanitizedErr.message : String(sanitizedErr),
            // sanitizeJsonControlChars only escapes \n, \r and \t. JSON forbids
            // every codepoint below U+0020 inside a string, so anything listed
            // here is a character the sanitizer passes through and the parser
            // then rejects — a gap that would be free to close.
            unhandledControlChars: [
              ...new Set(
                [...v].filter((c) => {
                  const code = c.charCodeAt(0);
                  return code < 0x20 && code !== 9 && code !== 10 && code !== 13;
                }),
              ),
            ].map((c) => `U+${c.charCodeAt(0).toString(16).padStart(4, "0").toUpperCase()}`),
          };
        }
        return v;
      }
    }
  };
  // Recorded either side of the coercion: "funnel: string → array(7)" says the
  // model sent a JSON string and we rescued it; "string → string" says the
  // rescue failed and names the field that broke the generation.
  const shapesBefore = {
    adScript: shapeOf(parsed.adScript),
    segments: shapeOf(parsed.adScript?.segments),
    funnel: shapeOf(parsed.funnel),
    automationMessages: shapeOf(parsed.automationMessages),
  };

  parsed.funnel = reparse(parsed.funnel, "funnel") as Parsed["funnel"];
  parsed.adScript = reparse(parsed.adScript, "adScript") as Parsed["adScript"];
  parsed.automationMessages = reparse(parsed.automationMessages, "automationMessages");
  if (parsed.adScript && typeof parsed.adScript === "object") {
    parsed.adScript.segments = reparse(
      parsed.adScript.segments,
      "segments",
    ) as Parsed["adScript"]["segments"];
  }

  // Only present when a coercion actually failed, so an empty object never
  // clutters a row. NOTE automationMessages is named here but is never shape-
  // checked further down — a parse failure there still reaches the customer as
  // six blank messages on an otherwise successful generation. Recording it is the
  // first step to knowing whether that happens.
  if (Object.keys(parseFailures).length) failMeta.parseFailures = parseFailures;

  failMeta.reparse = {
    before: shapesBefore,
    after: {
      adScript: shapeOf(parsed.adScript),
      segments: shapeOf(parsed.adScript?.segments),
      funnel: shapeOf(parsed.funnel),
      automationMessages: shapeOf(parsed.automationMessages),
    },
  };

  // Shape, not just type — see itemsHaveKeys. Results renders `stage`/`content`
  // per segment and `section`/`content` per funnel row, so anything else is a
  // blank page for the customer; failing here converts that silent blank into
  // the normal "please tap Regenerate" path, which the meter also records.
  /** The six follow-up messages, checked as strictly as the funnel.
   *
   *  The normalization further down is written to never throw: a string where an
   *  object belongs becomes `{}`, a missing field becomes "". So a coercion
   *  failure on this field produced a 200 with six blank WhatsApp and email
   *  messages, billed in full, counted as a success — the same silent blank the
   *  funnel check was added to stop, one field over. The customer would only find
   *  out when they went to send them. */
  const automationOk = (v: unknown): boolean => {
    const isObj = (x: unknown) => !!x && typeof x === "object" && !Array.isArray(x);
    const nonEmpty = (x: unknown) => typeof x === "string" && x.trim() !== "";
    if (!isObj(v)) return false;
    const o = v as Record<string, unknown>;
    if (!isObj(o.whatsapp) || !isObj(o.email)) return false;
    const wa = o.whatsapp as Record<string, unknown>;
    const em = o.email as Record<string, unknown>;
    const KINDS = ["greeting", "dayBefore", "currentDay"];
    if (!KINDS.every((k) => nonEmpty(wa[k]))) return false;
    return KINDS.every((k) => {
      if (!isObj(em[k])) return false;
      const item = em[k] as Record<string, unknown>;
      return nonEmpty(item.subject) && nonEmpty(item.body);
    });
  };

  const segmentsOk = itemsHaveKeys(parsed.adScript?.segments, ["stage", "content"]);
  const funnelOk = itemsHaveKeys(parsed.funnel, ["section", "content"]);
  const automationValid = automationOk(parsed.automationMessages);

  if (!segmentsOk || !funnelOk || !automationValid) {
    const cutOff = stopReason === "max_tokens";
    const broken: RepairField[] = [];
    if (!funnelOk) broken.push("funnel");
    if (!segmentsOk) broken.push("segments");

    failMeta.missing = [
      ...broken.map((f) => (f === "segments" ? "adScript.segments" : f)),
      ...(automationValid ? [] : ["automationMessages"]),
    ];
    failMeta.automationShape = shapeOf(parsed.automationMessages);
    // Which of the two it was: a field that never arrived, or one that arrived
    // with the wrong items. Same customer-facing message, different root cause.
    failMeta.itemShape = {
      segments: describeItems(parsed.adScript?.segments),
      funnel: describeItems(parsed.funnel),
    };
    failMeta.cutOff = cutOff;
    failMeta.brokenPreview = Object.fromEntries(
      broken.map((f) => [f, previewOf(f === "funnel" ? parsed.funnel : parsed.adScript?.segments)]),
    );

    // ── One repair attempt, server-side ────────────────────────────────────
    // Only worth trying if something usable arrived to anchor the voice to. If
    // the whole generation is empty there is nothing to be consistent with, and
    // a repair would just be a second full generation at a worse prompt.
    const keptAdCopy = typeof parsed.adCopy === "string" ? parsed.adCopy : "";
    const elapsedMs = Date.now() - startedAt;
    // Recorded on every failure, repaired or not — these are the numbers that
    // calibrate REPAIR_TIME_BUDGET_MS against what generations actually take.
    failMeta.elapsedMs = elapsedMs;

    const overTimeBudget = elapsedMs > REPAIR_TIME_BUDGET_MS;
    if (overTimeBudget) failMeta.skipReason = "time_budget";

    let repaired = false;

    // The repair tool only knows how to re-emit funnel and segments, so a broken
    // automationMessages cannot be fixed by it — failing straight through is
    // honest, where repairing the other fields would return a 200 that still had
    // six blank messages in it.
    if (!overTimeBudget && automationValid && (keptAdCopy || funnelOk || segmentsOk)) {
      const repairStartedAt = Date.now();
      const r = await repairFields(apiKey, system, lang, broken, {
        adCopy: keptAdCopy,
        funnel: funnelOk ? parsed.funnel : undefined,
        segments: segmentsOk ? parsed.adScript?.segments : undefined,
      });
      const repairMs = Date.now() - repairStartedAt;
      failMeta.repairMs = repairMs;

      if (r) {
        // The repair is held to the same standard as the original — a repair
        // that came back wrongly shaped is not an improvement.
        const funnelFixed = funnelOk || itemsHaveKeys(r.funnel, ["section", "content"]);
        const segmentsFixed = segmentsOk || itemsHaveKeys(r.segments, ["stage", "content"]);

        // Metered under its own event_type so it never touches the customer's
        // quota or the admin stats — checkRateLimit for this tool counts only
        // 'generation', the overview counts only 'generation' / 'posted', and
        // this row carries no client_key. Logged whether or not it worked: the
        // repair success rate is the number that decides whether this stays.
        await logToolUsage(sb, {
          tool_key: TOOL_KEY,
          event_type: "generation_repair",
          location_id: locationId,
          meta: {
            language: lang,
            requestId: requestId || null,
            fields: broken,
            ok: funnelFixed && segmentsFixed,
            stopReason: r.stopReason,
            inputTokens: r.inputTokens,
            outputTokens: r.outputTokens,
            // Both clocks: how long the generation had already burned before the
            // repair started, and what the repair itself added.
            elapsedMs,
            repairMs,
          },
        });

        if (funnelFixed && segmentsFixed) {
          if (!funnelOk) parsed.funnel = r.funnel as Parsed["funnel"];
          // adScript holds nothing but segments, and may itself be the string
          // that failed — rebuild it rather than assigning into it.
          if (!segmentsOk) {
            parsed.adScript = { segments: r.segments as Parsed["adScript"]["segments"] };
          }
          repaired = true;
        }
      }
    }

    // Recorded either way. `repaired` is what separates "the model produced an
    // unusable shape" (the rate worth tracking) from "the customer saw an error"
    // — without it, a working repair would hide the underlying failure rate.
    failMeta.repaired = repaired;
    await logFailure("incomplete_output");

    if (!repaired) {
      return json(
        {
          error: cutOff
            ? (lang === "en" ? "AI response was cut off — please tap Regenerate" : "AI 输出被截断，请点「重新生成」")
            : (lang === "en" ? "AI returned incomplete output — please tap Regenerate" : "AI 返回不完整，请点「重新生成」"),
        },
        502,
      );
    }
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

  const result = {
    language: lang,
    adScript: parsed.adScript,
    adCopy: parsed.adCopy,
    funnel: parsed.funnel,
    automationMessages,
  };

  // Park the finished result so a browser that walked away can still collect it
  // (see the `recover` branch above). Written AFTER the generation, unlike the
  // metering row at the top, which is written before — the meter charges for the
  // attempt, this stores what the attempt produced.
  //
  // Two independent reasons this cannot double-charge the customer's quota:
  // `checkRateLimit` above filters on `eventType: "generation"` and this row is
  // `generation_result`; and it carries NO `client_key`, which is the other
  // dimension the limiter counts on. The admin usage overview likewise filters
  // `event_type` ("generation" / "posted"), so this stays out of the stats.
  // Skipped entirely when the client sent no requestId — an unkeyed row could
  // never be matched back to its browser, so it would be dead weight.
  if (requestId) {
    await logToolUsage(sb, {
      tool_key: TOOL_KEY,
      event_type: "generation_result",
      location_id: locationId,
      meta: { language: lang, requestId, result, ...spend },
    });
  }

  return json(result);
});
