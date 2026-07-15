import { getSupabase } from "@/lib/supabase";

// ════════════════════════════════════════════════════════════════════════
// SHARED, tool-neutral GHL identity helpers (frontend side).
//
// How identity works (matches the Lovable original + NurtureOS): the admin is
// embedded in GoHighLevel via a custom-menu-link iframe whose URL carries the
// current sub-account's location_id (a GHL merge field, e.g.
// `?location_id={{location.id}}`). We read it from the URL, then resolve the
// full location via the shared `ghl` edge function (service role).
//
// No SSO / decryption yet — identity is trust-the-URL for now, hardened later.
// ════════════════════════════════════════════════════════════════════════

/** Read the GHL location_id from the URL — path (/location/:id) or query. */
export function getLocationIdFromUrl(
  pathname: string = typeof window !== "undefined" ? window.location.pathname : "",
  search: string = typeof window !== "undefined" ? window.location.search : "",
): string {
  const m = pathname.match(/\/location\/([^/?#]+)/);
  if (m?.[1]) return decodeURIComponent(m[1]);
  const p = new URLSearchParams(search);
  return p.get("locationId") || p.get("location_id") || "";
}

/** Sub-account (customer) view vs the agency root. */
export function isCustomerView(
  pathname: string = typeof window !== "undefined" ? window.location.pathname : "",
  search: string = typeof window !== "undefined" ? window.location.search : "",
): boolean {
  if (/\/location\//.test(pathname)) return true;
  const p = new URLSearchParams(search);
  return (
    p.get("view") === "customer" ||
    p.get("ghl") === "true" ||
    p.get("embed") === "true" ||
    !!p.get("locationId") ||
    !!p.get("location_id")
  );
}

/** Embedded inside the GHL iframe → hide the Playbook site chrome. */
export function isEmbed(
  search: string = typeof window !== "undefined" ? window.location.search : "",
): boolean {
  const p = new URLSearchParams(search);
  return p.get("embed") === "true" || p.get("ghl") === "true";
}

export type GhlLocation = {
  location_id: string;
  business_name: string | null;
  logo_url: string | null;
  niche: string | null;
  email: string | null;
  phone: string | null;
  is_enabled: boolean;
};

/** Call the shared `ghl` edge function (service role behind it). */
export async function callGhl<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke("ghl", {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

export async function fetchLocation(locationId: string): Promise<GhlLocation | null> {
  const { location } = await callGhl<{ location: GhlLocation | null }>("getLocation", { locationId });
  return location;
}

/** All sub-account locations (enabled + disabled) for the agency views. */
export async function listLocations(): Promise<GhlLocation[]> {
  const { locations } = await callGhl<{ locations: GhlLocation[] }>("listLocations");
  return locations || [];
}

/** Toggle whether a sub-account can use the tool. */
export async function setLocationEnabled(locationId: string, enabled: boolean): Promise<void> {
  await callGhl("setEnabled", { locationId, enabled });
}

/** Pull sub-accounts from GoHighLevel into ghl_locations (via the sync edge fn). */
export async function syncLocations(): Promise<{ total: number }> {
  const { data, error } = await getSupabase().functions.invoke("sync-ghl-locations", { body: {} });
  if (error) throw error;
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  return data as { total: number };
}
