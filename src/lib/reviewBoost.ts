import { getSupabase } from "@/lib/supabase";

// Review Boost customer-scoped API — wraps the `rb` edge function. Every call
// passes the sub-account's own locationId (from the URL); the function scopes
// all data to it. The frontend never touches tables directly.

export type RBPlatformLink = {
  id: string;
  platform: string;       // google_maps | facebook | shopee | custom
  review_url: string;     // a link always has a URL (no empty rows)
  label: string | null;   // optional name/note the owner gives it (e.g. 美容院-总店)
  created_at?: string;
};

export type RBQrCode = {
  id: string;
  short_code: string;
  scan_count: number;
  is_active: boolean;
};

export type RBCampaign = {
  id: string;
  location_id: string;
  name: string;
  platform: string;
  integration_id: string | null;
  business_name: string | null;
  industry: string | null;
  category: string | null;
  signature_features: string[];
  logo_url: string | null;
  thank_you_mode: "message" | "url";
  thank_you_message: string | null;
  redirect_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  rb_qr_codes?: RBQrCode[];
  /** The specific platform link this campaign points at (null if unset/deleted). */
  integration?: Pick<RBPlatformLink, "id" | "platform" | "label" | "review_url"> | null;
};

export type RBGeneration = {
  id: string;
  review_text: string;
  persona: string | null;
  rating: number;
  posted: boolean;
  created_at: string;
};

/** The fields the campaign form sends (id present = update, absent = create). */
export type RBCampaignInput = {
  id?: string;
  name: string;
  platform?: string;
  integration_id?: string | null;
  business_name?: string | null;
  industry?: string | null;
  category?: string | null;
  signature_features?: string[];
  logo_url?: string | null;
  thank_you_mode?: "message" | "url";
  thank_you_message?: string | null;
  redirect_url?: string | null;
  is_active?: boolean;
};

/** First (usually only) QR short-code for a campaign, or null before one exists. */
export function campaignShortCode(c: RBCampaign): string | null {
  return c.rb_qr_codes?.[0]?.short_code ?? null;
}

async function callRb<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke("rb", {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

/**
 * Whether Review Boost is enabled for this location (Admin Portal toggle).
 * Fail-OPEN on transient errors — the server still gates every real action, so
 * a network blip shouldn't wrongly show the "not available" block.
 */
export async function checkRbAccess(locationId: string): Promise<boolean> {
  try {
    const { data, error } = await getSupabase().functions.invoke("rb", {
      body: { action: "access", locationId },
    });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const b = await ctx.json();
          if (b?.error === "tool_disabled") return false;
        } catch {
          /* not JSON — treat as transient */
        }
      }
      return true; // transient / unknown → fail-open
    }
    if (data && (data as { error?: string }).error === "tool_disabled") return false;
    return true;
  } catch {
    return true;
  }
}

/** All this location's platform links (many per platform). Scoped server-side. */
export async function listPlatforms(locationId: string): Promise<RBPlatformLink[]> {
  const { platforms } = await callRb<{ platforms: RBPlatformLink[] }>("listPlatforms", { locationId });
  return platforms || [];
}

/**
 * Add a link (no id → needs `platform`) or edit one (with id → url/label only).
 * A link must have a URL; the label is optional.
 */
export async function savePlatformLink(
  locationId: string,
  link: { id?: string; platform?: string; review_url: string; label: string | null },
): Promise<RBPlatformLink> {
  const { platform } = await callRb<{ platform: RBPlatformLink }>("savePlatformLink", { locationId, ...link });
  return platform;
}

/** Delete one platform link by id. Campaigns pointing at it just lose the link. */
export async function deletePlatformLink(locationId: string, id: string): Promise<void> {
  await callRb<{ ok: true }>("deletePlatformLink", { locationId, id });
}

/** All campaigns for this location (newest first). Scoped server-side. */
export async function listCampaigns(locationId: string): Promise<RBCampaign[]> {
  const { campaigns } = await callRb<{ campaigns: RBCampaign[] }>("listCampaigns", { locationId });
  return campaigns || [];
}

/** One campaign by id (own location only); null if it isn't this location's. */
export async function getCampaign(locationId: string, id: string): Promise<RBCampaign | null> {
  const { campaign } = await callRb<{ campaign: RBCampaign | null }>("getCampaign", { locationId, id });
  return campaign ?? null;
}

/** Create (no id) or update (with id) a campaign. Create also mints its QR code. */
export async function saveCampaign(locationId: string, input: RBCampaignInput): Promise<RBCampaign> {
  const { campaign } = await callRb<{ campaign: RBCampaign }>("saveCampaign", { locationId, ...input });
  return campaign;
}

/** Delete a campaign (cascades its QR code + generations). Own location only. */
export async function deleteCampaign(locationId: string, id: string): Promise<void> {
  await callRb<{ ok: true }>("deleteCampaign", { locationId, id });
}

/** A campaign's AI-review history (empty until the Phase 7 scan flow writes rows). */
export async function listGenerations(locationId: string, campaignId: string): Promise<RBGeneration[]> {
  const { generations } = await callRb<{ generations: RBGeneration[] }>("listGenerations", {
    locationId,
    campaignId,
  });
  return generations || [];
}

// ── Dashboard stats (this location only) ──────────────────────────────────

export type RBStats = {
  totals: { scans: number; posted: number; generations: number };
  perCampaign: { id: string; name: string; platform: string; scans: number; posted: number }[];
  daily: { date: string; scans: number }[];
};

/** Aggregated dashboard stats for this location (scoped server-side). */
export async function getStats(locationId: string): Promise<RBStats> {
  const { stats } = await callRb<{ stats: RBStats }>("getStats", { locationId });
  return stats;
}

// ── AI review generation (Claude, via the `generate-review` edge function) ──

export type RBReviewSample = { review_text: string; persona: string | null };
export type RBReviewLanguage = "cn" | "en" | "ms";

/**
 * Preview AI-written reviews for a campaign (admin test). Scoped to the caller's
 * own location server-side; writes nothing to the DB. Retries a few times since
 * each attempt is an independent Claude call (dodges transient edge/API blips).
 */
export async function previewReviews(
  locationId: string,
  campaignId: string,
  opts: { language: RBReviewLanguage; count?: number } = { language: "cn" },
): Promise<RBReviewSample[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await getSupabase().functions.invoke("generate-review", {
        body: { mode: "preview", locationId, campaignId, language: opts.language, count: opts.count ?? 3 },
      });
      if (error) throw error;
      if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
        throw new Error((data as { error: string }).error);
      }
      return ((data as { reviews?: RBReviewSample[] })?.reviews) || [];
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Failed to generate reviews");
}

// ── Public scan flow (customer, no login) — via `generate-review` ──────────

export type RBScanResult = {
  generation: { id: string; review_text: string; persona: string | null; rating: number };
  campaign: {
    name: string | null;
    logo_url: string | null;
    thank_you_mode: "message" | "url";
    redirect_url: string | null;
  };
  platform: { platform: string; review_url: string; label: string | null } | null;
};

export type RBThankYou = {
  business_name: string | null;
  logo_url: string | null;
  thank_you_mode: "message" | "url";
  thank_you_message: string | null;
  redirect_url: string | null;
};

// Business error codes the server returns (don't retry these; map to friendly UI).
const SCAN_BIZ_ERRORS = new Set([
  "inactive",
  "tool_disabled",
  "rate_limited",
  "expired",
  "not found",
  "generation failed",
  "code required",
  "generationId required",
]);

/** Invoke generate-review, surfacing the server's {error} string even on non-2xx. */
async function invokeGenReview<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke("generate-review", { body });
  if (error) {
    let msg = error instanceof Error ? error.message : "request failed";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const b = await ctx.json();
        if (b?.error) msg = String(b.error);
      }
    } catch {
      /* keep generic message */
    }
    throw new Error(msg);
  }
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

async function genReviewWithRetry<T>(body: Record<string, unknown>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await invokeGenReview<T>(body);
    } catch (e) {
      lastErr = e;
      if (e instanceof Error && SCAN_BIZ_ERRORS.has(e.message)) throw e; // don't retry business errors
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Failed");
}

/** Customer scans → generate 1 review, save it, bump scan_count. */
export function scanReview(code: string, language: RBReviewLanguage = "cn"): Promise<RBScanResult> {
  return genReviewWithRetry<RBScanResult>({ mode: "scan", code, language });
}

/** Regenerate the review shown on this scan (updates in place; no new scan). */
export async function regenerateReview(
  code: string,
  generationId: string,
  language: RBReviewLanguage = "cn",
): Promise<RBScanResult["generation"]> {
  const { generation } = await genReviewWithRetry<{ generation: RBScanResult["generation"] }>({
    mode: "regenerate",
    code,
    generationId,
    language,
  });
  return generation;
}

/** Customer confirmed they posted → sets posted=true (the posted-rate signal). */
export async function markPosted(generationId: string): Promise<void> {
  await invokeGenReview<{ ok: true }>({ mode: "posted", generationId });
}

/** Thank-you page content (public, by generationId). */
export async function getThankYou(generationId: string): Promise<RBThankYou> {
  const { thankYou } = await invokeGenReview<{ thankYou: RBThankYou }>({ mode: "thankyou", generationId });
  return thankYou;
}
