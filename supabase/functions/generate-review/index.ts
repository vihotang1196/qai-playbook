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

// ── Abuse limits for the PUBLIC scan flow (owner chose per-QR rate limiting,
//    counted from existing rb_generations rows — no new table, no IP/PII) ──
const HOURLY_CAP = 60; // max reviews generated per QR per hour
const DAILY_CAP = 300; // max reviews generated per QR per day
// Regenerate can only target a row created within this window (stops an old
// generationId being reused to burn API forever).
const REGEN_MAX_AGE_MS = 60 * 60 * 1000;

/** How many reviews this QR has generated within the last `sinceMs`. */
async function countRecent(
  sb: ReturnType<typeof serviceClient>,
  qrId: string,
  sinceMs: number,
): Promise<number> {
  const since = new Date(Date.now() - sinceMs).toISOString();
  const { count, error } = await sb
    .from("rb_generations")
    .select("id", { count: "exact", head: true })
    .eq("qr_code_id", qrId)
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

/** The specific platform link a campaign points at (Option B: integration_id). */
async function resolvePlatformLink(
  sb: ReturnType<typeof serviceClient>,
  integrationId: string | null,
) {
  if (!integrationId) return null;
  const { data, error } = await sb
    .from("rb_platform_integrations")
    .select("platform, review_url, label")
    .eq("id", integrationId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

const CAMPAIGN_FIELDS =
  "business_name, industry, category, signature_features, platform, name, logo_url, " +
  "integration_id, thank_you_mode, thank_you_message, redirect_url, is_active";

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

    // ── PUBLIC scan flow (customer, no login) ────────────────────────
    if (mode === "scan") {
      const code = String(body?.code || "").trim();
      if (!code) return json({ error: "code required" }, 400);
      const sb = serviceClient();

      const { data: qr, error: qrErr } = await sb
        .from("rb_qr_codes")
        .select(`id, campaign_id, location_id, is_active, rb_campaigns(${CAMPAIGN_FIELDS})`)
        .eq("short_code", code)
        .maybeSingle();
      if (qrErr) throw qrErr;
      const campaign = (qr?.rb_campaigns || null) as (Campaign & Record<string, unknown>) | null;
      if (!qr || !qr.is_active || !campaign || campaign.is_active === false) {
        return json({ error: "inactive" }, 404);
      }

      // Per-QR rate limit (bounds API spend for a hammered code).
      if ((await countRecent(sb, qr.id, 3_600_000)) >= HOURLY_CAP) return json({ error: "rate_limited" }, 429);
      if ((await countRecent(sb, qr.id, 86_400_000)) >= DAILY_CAP) return json({ error: "rate_limited" }, 429);

      const [review] = await generate(campaign, language, 1);
      if (!review) return json({ error: "generation failed" }, 500);

      const { data: gen, error: insErr } = await sb
        .from("rb_generations")
        .insert({
          campaign_id: qr.campaign_id,
          qr_code_id: qr.id,
          location_id: qr.location_id,
          review_text: review.review_text,
          persona: review.persona,
          rating: 5,
        })
        .select("id, review_text, persona, rating")
        .single();
      if (insErr) throw insErr;

      // One scan = one review generated = one scan_count bump.
      await sb.rpc("increment_scan_count", { qr_id: qr.id }).then(
        () => {},
        () => {}, // non-fatal
      );

      const platform = await resolvePlatformLink(sb, (campaign.integration_id as string) || null);
      return json({
        generation: gen,
        campaign: {
          // Customer sees the business identity, not the owner's internal campaign title.
          name: (campaign.business_name as string) || campaign.name,
          logo_url: campaign.logo_url,
          thank_you_mode: campaign.thank_you_mode,
          redirect_url: campaign.redirect_url,
        },
        platform,
      });
    }

    // Regenerate the review shown on THIS scan (owner chose: no new scan_count,
    // no new row — update in place). Anti-tamper: the generation must belong to
    // this code; shares the per-QR hourly cap; only for a recently-created scan.
    if (mode === "regenerate") {
      const code = String(body?.code || "").trim();
      const generationId = String(body?.generationId || "").trim();
      if (!code || !generationId) return json({ error: "code and generationId required" }, 400);
      const sb = serviceClient();

      const { data: gen, error } = await sb
        .from("rb_generations")
        .select(`id, qr_code_id, created_at, rb_qr_codes!inner(short_code), rb_campaigns!inner(${CAMPAIGN_FIELDS})`)
        .eq("id", generationId)
        .maybeSingle();
      if (error) throw error;
      const belongs = gen && (gen.rb_qr_codes as { short_code?: string })?.short_code === code;
      if (!belongs) return json({ error: "not found" }, 404);
      if (Date.now() - new Date(gen.created_at as string).getTime() > REGEN_MAX_AGE_MS) {
        return json({ error: "expired" }, 410);
      }
      if ((await countRecent(sb, gen.qr_code_id as string, 3_600_000)) >= HOURLY_CAP) {
        return json({ error: "rate_limited" }, 429);
      }

      const [review] = await generate(gen.rb_campaigns as unknown as Campaign, language, 1);
      if (!review) return json({ error: "generation failed" }, 500);

      const { data: updated, error: upErr } = await sb
        .from("rb_generations")
        .update({ review_text: review.review_text, persona: review.persona })
        .eq("id", generationId)
        .select("id, review_text, persona, rating")
        .single();
      if (upErr) throw upErr;
      return json({ generation: updated });
    }

    // Customer confirmed they posted → the posted-rate data point.
    if (mode === "posted") {
      const generationId = String(body?.generationId || "").trim();
      if (!generationId) return json({ error: "generationId required" }, 400);
      const sb = serviceClient();
      const { error } = await sb
        .from("rb_generations")
        .update({ posted: true })
        .eq("id", generationId)
        .eq("posted", false);
      if (error) throw error;
      return json({ ok: true });
    }

    // Thank-you page content by generationId (public).
    if (mode === "thankyou") {
      const generationId = String(body?.generationId || "").trim();
      if (!generationId) return json({ error: "generationId required" }, 400);
      const sb = serviceClient();
      const { data: gen, error } = await sb
        .from("rb_generations")
        .select("rb_campaigns(name, business_name, logo_url, thank_you_mode, thank_you_message, redirect_url)")
        .eq("id", generationId)
        .maybeSingle();
      if (error) throw error;
      const c = (gen?.rb_campaigns || null) as
        | { name?: string; business_name?: string; logo_url?: string; thank_you_mode?: string; thank_you_message?: string; redirect_url?: string }
        | null;
      if (!c) return json({ error: "not found" }, 404);
      return json({
        thankYou: {
          business_name: c.business_name ?? c.name ?? null,
          logo_url: c.logo_url ?? null,
          thank_you_mode: c.thank_you_mode ?? "message",
          thank_you_message: c.thank_you_message ?? null,
          redirect_url: c.redirect_url ?? null,
        },
      });
    }

    return json({ error: `Unsupported mode: ${mode}` }, 400);
  } catch (e) {
    console.error("generate-review fn error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
