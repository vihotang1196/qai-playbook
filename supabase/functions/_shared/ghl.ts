// ════════════════════════════════════════════════════════════════════════
// SHARED, tool-neutral GHL identity / location helpers (Deno).
//
// Imported by any tool's edge functions — Review Boost now; copywriter and
// Offline Event later. Keep this GHL-generic: it only knows about the shared
// `ghl_locations` identity table, never a tool's own tables.
//
// Security note: identity currently = the location_id passed in the request
// (which the frontend read from the URL — GHL custom-menu-link style). It is
// NOT cryptographically verified yet. When we add GHL SSO, the verification
// goes in ONE place here (verifyGhlSso) and every tool inherits it.
// ════════════════════════════════════════════════════════════════════════
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** JSON response with CORS headers. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Service-role Supabase client — BYPASSES RLS. Never expose this key to the
 * frontend; it only ever lives inside edge functions. SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are auto-injected by Supabase at runtime.
 */
export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase service env not configured");
  return createClient(url, key, { auth: { persistSession: false } });
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

const LOCATION_COLS = "location_id, business_name, logo_url, niche, email, phone, is_enabled";

/** Resolve one GHL location (sub-account) by its GHL location_id. */
export async function getLocation(
  sb: SupabaseClient,
  locationId: string,
): Promise<GhlLocation | null> {
  const id = (locationId || "").trim();
  if (!id) return null;
  const { data, error } = await sb
    .from("ghl_locations")
    .select(LOCATION_COLS)
    .eq("location_id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as GhlLocation) ?? null;
}

/**
 * List ALL locations (enabled + disabled), for the agency picker + the
 * sub-accounts management page (which needs the disabled ones to toggle them).
 */
export async function listLocations(sb: SupabaseClient): Promise<GhlLocation[]> {
  const { data, error } = await sb
    .from("ghl_locations")
    .select(LOCATION_COLS)
    .order("business_name", { ascending: true });
  if (error) throw error;
  return (data as GhlLocation[]) ?? [];
}

/** Enable/disable a location (agency toggles which sub-accounts can use the tool). */
export async function setLocationEnabled(
  sb: SupabaseClient,
  locationId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await sb
    .from("ghl_locations")
    .update({ is_enabled: enabled })
    .eq("location_id", locationId);
  if (error) throw error;
}

/**
 * Decode the agency companyId from a GHL token. Private-Integration / OAuth
 * tokens are JWTs whose payload carries `companyId` (a.k.a. `authClassId` for a
 * Company-scoped token). Lets us skip a manually-provided GHL_COMPANY_ID.
 */
export function companyIdFromToken(token: string): string | null {
  try {
    const parts = (token || "").split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const payload = JSON.parse(atob(b64 + pad));
    return payload.companyId || payload.authClassId || payload.company_id || null;
  } catch {
    return null;
  }
}

export type GhlSyncResult = { total: number; companyId: string };

/**
 * Pull all sub-account locations from GoHighLevel and upsert them into
 * ghl_locations. Auth = the PIT in GHL_AGENCY_API_KEY (Bearer, v2 API). The
 * companyId comes from GHL_COMPANY_ID if set, else it's decoded from the token.
 * `is_enabled` / `user_id` are intentionally NOT upserted, so existing toggles
 * and owner mappings survive a re-sync.
 */
export async function syncGhlLocations(sb: SupabaseClient): Promise<GhlSyncResult> {
  const token = Deno.env.get("GHL_AGENCY_API_KEY");
  if (!token) throw new Error("GHL_AGENCY_API_KEY not configured");

  let companyId = Deno.env.get("GHL_COMPANY_ID") || "";
  if (!companyId) {
    companyId = companyIdFromToken(token) || "";
    if (!companyId) {
      throw new Error(
        "Could not derive companyId from the token. Set the GHL_COMPANY_ID secret " +
          "manually (decode your PIT at jwt.io → the `companyId` field).",
      );
    }
  }

  const limit = 100;
  let skip = 0;
  const rows: Record<string, unknown>[] = [];
  const now = new Date().toISOString();

  while (true) {
    const url =
      `https://services.leadconnectorhq.com/locations/search?companyId=${encodeURIComponent(companyId)}` +
      `&limit=${limit}&skip=${skip}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        Version: "2021-07-28",
      },
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`GHL API error [${resp.status}]: ${body}`);
    }
    const data = await resp.json();
    const locations: any[] = data.locations || [];
    for (const loc of locations) {
      rows.push({
        location_id: loc.id,
        business_name: loc.name ?? null,
        logo_url: loc.logoUrl ?? null,
        niche: loc.settings?.industry ?? null,
        email: loc.email ?? null,
        phone: loc.phone ?? null,
        synced_at: now,
      });
    }
    if (locations.length < limit) break;
    skip += limit;
  }

  if (rows.length > 0) {
    const { error } = await sb
      .from("ghl_locations")
      .upsert(rows, { onConflict: "location_id", ignoreDuplicates: false });
    if (error) throw error;
  }

  // One-time cleanup of the Phase-2 dev fixture (safe: real GHL ids are never
  // "demo-loc-001").
  await sb.from("ghl_locations").delete().eq("location_id", "demo-loc-001");

  return { total: rows.length, companyId };
}
