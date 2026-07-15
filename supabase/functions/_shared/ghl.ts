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
 * List enabled locations — for the agency picker. Populated by the GHL sync
 * in Phase 3; returns [] until then.
 */
export async function listLocations(sb: SupabaseClient): Promise<GhlLocation[]> {
  const { data, error } = await sb
    .from("ghl_locations")
    .select(LOCATION_COLS)
    .eq("is_enabled", true)
    .order("business_name", { ascending: true });
  if (error) throw error;
  return (data as GhlLocation[]) ?? [];
}
