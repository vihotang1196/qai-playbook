import { getSupabase } from "@/lib/supabase";

// Review Boost customer-scoped API — wraps the `rb` edge function. Every call
// passes the sub-account's own locationId (from the URL); the function scopes
// all data to it. The frontend never touches tables directly.

export type RBPlatformConfig = {
  id?: string;
  platform: string;
  review_url: string | null;
  is_enabled: boolean;
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

/** This location's platform configs (links). Scoped to locationId server-side. */
export async function listPlatforms(locationId: string): Promise<RBPlatformConfig[]> {
  const { platforms } = await callRb<{ platforms: RBPlatformConfig[] }>("listPlatforms", { locationId });
  return platforms || [];
}

/** Create/update one platform's config for this location. */
export async function savePlatform(
  locationId: string,
  cfg: { platform: string; review_url: string | null; is_enabled: boolean },
): Promise<RBPlatformConfig> {
  const { platform } = await callRb<{ platform: RBPlatformConfig }>("savePlatform", { locationId, ...cfg });
  return platform;
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
