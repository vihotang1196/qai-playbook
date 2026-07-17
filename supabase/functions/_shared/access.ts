// ════════════════════════════════════════════════════════════════════════
// Shared per-tool access gate (Admin Portal → tools).
//
// hasToolAccess reads location_tool_access, DEFAULT-ALLOW: no row (never set) OR
// enabled=true → allowed; enabled=false → blocked. Tools call this server-side
// before doing anything for a location; the Admin Portal is the only writer.
// ════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export async function hasToolAccess(
  sb: SupabaseClient,
  locationId: string,
  toolKey: string,
): Promise<boolean> {
  const id = (locationId || "").trim();
  if (!id) return false;
  const { data, error } = await sb
    .from("location_tool_access")
    .select("enabled")
    .eq("location_id", id)
    .eq("tool_key", toolKey)
    .maybeSingle();
  if (error) throw error;
  if (!data) return true; // default-allow
  return data.enabled !== false;
}
