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
