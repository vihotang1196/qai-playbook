// ════════════════════════════════════════════════════════════════════════
// Review Boost — AI review generation (Claude).
//
// Calls the Claude Messages API (claude-sonnet-4-5, tool-use for structured
// JSON, non-streaming). The ANTHROPIC_API_KEY lives ONLY as a Supabase Edge
// secret (shared with the copywriter) — never in the repo or the frontend.
//
// Modes:
//   preview — admin tests a campaign's output. REQUIRES locationId + campaignId,
//             verifies the campaign belongs to that location (own-data only),
//             generates N sample reviews, writes NOTHING to the DB.
//   scan    — (Phase 7) the public customer flow; resolves the campaign by its
//             QR short_code, generates 1 review, saves an rb_generations row.
//             Not wired yet — preview is what Phase 6 ships.
// ════════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, serviceClient } from "../_shared/ghl.ts";

const MODEL = "claude-sonnet-4-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Language instruction fed to the model (Malaysian-Chinese market is the default).
// Each one names the DOMINANT language so switching actually switches — the
// business info is in Chinese, so without this the model drifts Chinese-heavy.
const LANGUAGE_HINT: Record<string, string> = {
  cn: "主要用华文写（马来西亚华人平时讲话的自然口语，可以偶尔夹一两个英文/Manglish 词，像本地人随手打的）",
  en: "Write the review PRIMARILY in English — casual Malaysian English, the way a real local types it. An occasional local word is fine, but it must read as an English review, not Chinese.",
  ms: "Tulis review INI DALAM Bahasa Melayu — santai, gaya pelanggan tempatan. Boleh selit satu dua perkataan English, tapi ia mesti berbunyi sebagai review Melayu, bukan Cina.",
};

// Structured-output tool: the model MUST return reviews through this.
const REVIEW_TOOL = {
  name: "write_reviews",
  description: "Return the generated 5-star customer reviews.",
  input_schema: {
    type: "object",
    properties: {
      reviews: {
        type: "array",
        description: "One entry per review.",
        items: {
          type: "object",
          properties: {
            review_text: { type: "string", description: "The review exactly as the customer would post it." },
            persona: { type: "string", description: "A short label for who this reviewer is, e.g. '30代上班族妈妈'." },
          },
          required: ["review_text", "persona"],
        },
      },
    },
    required: ["reviews"],
  },
};

type Campaign = {
  business_name: string | null;
  industry: string | null;
  category: string | null;
  signature_features: string[] | null;
  platform: string | null;
  name: string | null;
};

function systemPrompt(languageHint: string, count: number): string {
  return [
    "You generate genuine-sounding 5-star customer reviews for a real local business.",
    "Write as REAL customers would — never like a marketer or an AI.",
    "",
    "Rules for making them feel real:",
    "- First person, casual, spoken. Like a real person quickly typing a review on their phone.",
    "- Each review is from a DIFFERENT persona (age, gender, life situation, how they talk). Give a short persona label.",
    "- VARY length and shape: some one short line, some two or three lines. Never uniform.",
    "- Mention 1–2 SPECIFIC things from the business info (a named feature, the vibe, the staff, the price feel). Never 'everything was great'.",
    "- Do NOT invent facts that could be wrong: no specific staff names, exact dates, or exact prices.",
    "- Avoid AI tells: no em-dashes, no 'overall/furthermore/in conclusion', no over-polished grammar, no stacked superlatives, no slogans.",
    "- Occasional emoji is fine (not every review). Casual punctuation / lowercase is fine.",
    `- Language: ${languageHint}.`,
    "- Every review is a happy 5-star review, but it must read like a real satisfied customer, not an advertisement.",
    "",
    `Return exactly ${count} review(s) via the write_reviews tool.`,
  ].join("\n");
}

function userPrompt(c: Campaign, count: number): string {
  const feats = (c.signature_features || []).filter(Boolean);
  const lines = [
    c.business_name ? `商家名：${c.business_name}` : null,
    c.industry ? `行业：${c.industry}` : null,
    c.category ? `品类：${c.category}` : null,
    feats.length ? `招牌/卖点：${feats.join("、")}` : null,
    c.platform ? `发布平台：${c.platform}` : null,
  ].filter(Boolean);
  return `这次要夸的商家资料：\n${lines.join("\n")}\n\n请写 ${count} 条五星好评。`;
}

async function generate(campaign: Campaign, language: string, count: number) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  const hint = LANGUAGE_HINT[language] || LANGUAGE_HINT.cn;

  const resp = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      temperature: 1,
      system: systemPrompt(hint, count),
      tools: [REVIEW_TOOL],
      tool_choice: { type: "tool", name: "write_reviews" },
      messages: [{ role: "user", content: userPrompt(campaign, count) }],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Claude API error [${resp.status}]: ${body}`);
  }
  const data = await resp.json();
  const block = (data.content || []).find(
    (b: { type?: string; name?: string }) => b.type === "tool_use" && b.name === "write_reviews",
  );
  const reviews = block?.input?.reviews;
  if (!Array.isArray(reviews) || reviews.length === 0) {
    throw new Error("Model returned no reviews");
  }
  return reviews
    .map((r: { review_text?: unknown; persona?: unknown }) => ({
      review_text: String(r?.review_text || "").trim(),
      persona: String(r?.persona || "").trim() || null,
    }))
    .filter((r) => r.review_text);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || "preview");
    const language = String(body?.language || "cn");

    if (mode === "preview") {
      const locationId = String(body?.locationId || "").trim();
      const campaignId = String(body?.campaignId || "").trim();
      if (!locationId) return json({ error: "locationId required" }, 400);
      if (!campaignId) return json({ error: "campaignId required" }, 400);
      // Clamp preview count to a small range (owner is judging quality/variety).
      const count = Math.min(Math.max(Number(body?.count) || 3, 1), 5);

      const sb = serviceClient();
      // Own-data only: the campaign must belong to THIS location.
      const { data: campaign, error } = await sb
        .from("rb_campaigns")
        .select("business_name, industry, category, signature_features, platform, name")
        .eq("location_id", locationId)
        .eq("id", campaignId)
        .maybeSingle();
      if (error) throw error;
      if (!campaign) return json({ error: "Campaign not found" }, 404);

      const reviews = await generate(campaign as Campaign, language, count);
      return json({ reviews });
    }

    // scan mode = Phase 7 (public, by short_code, saves rb_generations).
    return json({ error: `Unsupported mode: ${mode}` }, 400);
  } catch (e) {
    console.error("generate-review fn error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
