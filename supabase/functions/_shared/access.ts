// ════════════════════════════════════════════════════════════════════════
// Shared per-tool access gate (Admin Portal → tools).
//
// TWO MODES, switched by the stored `canary_mode` flag (platform_settings),
// which the owner flips from the Admin Portal — no redeploy, no code change:
//
//   NORMAL (canary off) — DEFAULT-ALLOW. No row for a location = allowed; only an
//     explicit enabled=false blocks. Steady-state behaviour.
//   CANARY (canary on)  — DEFAULT-DENY. location_tool_access becomes a WHITELIST:
//     only an explicit enabled=true gets in. For a gradual launch where a single
//     hand-picked sub-account should be able to use the platform.
//
// Signed-in ADMINS always pass, in either mode, so the owner can never lock
// himself out of his own tools. That check is server-enforced (requireAdmin
// validates the session JWT) and runs ONLY when access would otherwise be
// denied, so normal customer traffic never pays for it.
// ════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireAdmin } from "./admin.ts";

// ── Canary flag, cached per function instance ─────────────────────────────
// Edge instances are reused across requests, so a short TTL keeps the extra
// lookup to a couple of queries per minute per instance while still picking up
// an Admin Portal flip within seconds.
const CANARY_TTL_MS = 20_000;
let canaryCache: { value: boolean; at: number } | null = null;

export async function isCanaryMode(sb: SupabaseClient): Promise<boolean> {
  const now = Date.now();
  if (canaryCache && now - canaryCache.at < CANARY_TTL_MS) return canaryCache.value;
  try {
    const { data } = await sb
      .from("platform_settings")
      .select("value")
      .eq("key", "canary_mode")
      .maybeSingle();
    const enabled = (data?.value as { enabled?: boolean } | null)?.enabled === true;
    canaryCache = { value: enabled, at: now };
    return enabled;
  } catch (e) {
    // Fail OPEN (treat as normal mode): a settings-read blip must not lock every
    // customer out of every tool. Explicit enabled=false rows still apply.
    console.error("isCanaryMode failed (assuming normal mode):", e);
    return false;
  }
}

/**
 * The one access gate. Pass `req` to also grant signed-in platform admins access
 * (recommended for every customer-facing endpoint, so the owner can always open
 * his own tools). The admin check runs ONLY when access would otherwise be
 * denied, so normal traffic never pays for the extra auth round-trip.
 */
export async function hasToolAccess(
  sb: SupabaseClient,
  locationId: string,
  toolKey: string,
  req?: Request,
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

  // no row: canary → deny (whitelist), normal → allow (default-allow)
  const granted = data ? data.enabled !== false : !(await isCanaryMode(sb));
  if (granted) return true;
  return req ? await isAdminRequest(req) : false;
}

/** Is the caller a signed-in platform admin? Never throws. */
async function isAdminRequest(req: Request): Promise<boolean> {
  try {
    return !!(await requireAdmin(req));
  } catch {
    return false;
  }
}
