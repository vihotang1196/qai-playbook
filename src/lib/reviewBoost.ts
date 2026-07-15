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
