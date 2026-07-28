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

// ── ONE master switch per sub-account (owner decision) ────────────────────
// The Playbook is sold as ONE product, not as separately-purchasable tools, so
// access is a single "Playbook on/off" per sub-account instead of a per-tool
// matrix. It is stored in location_tool_access under this reserved key, reusing
// the existing table + Admin Portal + audit-log plumbing.
//
// The older per-tool rows (review_boost / copywriter / offline_event / helpdesk)
// are left in the table but are NO LONGER CONSULTED — kept only so the split
// could be reinstated later without a data loss.
export const PLAYBOOK_KEY = "playbook";

/**
 * The one access gate: may this sub-account use the Playbook at all?
 *
 * Pass `req` to also grant signed-in platform admins access (recommended for
 * every customer-facing endpoint, so the owner can never lock himself out). The
 * admin check runs ONLY when access would otherwise be denied, so normal traffic
 * never pays for the extra auth round-trip.
 */
export async function hasPlaybookAccess(
  sb: SupabaseClient,
  locationId: string,
  req?: Request,
): Promise<boolean> {
  const id = (locationId || "").trim();
  if (!id) return false;

  const { data, error } = await sb
    .from("location_tool_access")
    .select("enabled")
    .eq("location_id", id)
    .eq("tool_key", PLAYBOOK_KEY)
    .maybeSingle();
  if (error) throw error;

  // no row: canary → deny (whitelist), normal → allow (default ON)
  const granted = data ? data.enabled !== false : !(await isCanaryMode(sb));
  if (granted) return true;
  return req ? await isAdminRequest(req) : false;
}

// ── Offline Event sub-switch ──────────────────────────────────────────────
// Booking a paid, seat-limited, physical event is not the same commitment as
// reading the help center, so Offline Event gets ONE extra gate on top of the
// master switch: "may this customer book offline classes?"
//
// Semantics deliberately differ from the master switch — this is an explicit
// OPT-OUT, never a whitelist:
//   no row          → allowed (all 911 sub-accounts start able to book)
//   enabled = false → blocked, even though the Playbook itself is on
// Canary mode is NOT consulted here; the master switch already decides who is
// in the rollout at all, and making this a second whitelist would mean hand-
// toggling every sub-account twice.
export const OFFLINE_EVENT_KEY = "offline_event";

/**
 * The Offline Event gate: master Playbook switch AND the per-customer booking
 * opt-out. Admins pass either way (same reasoning as `hasPlaybookAccess`).
 */
export async function hasOfflineEventAccess(
  sb: SupabaseClient,
  locationId: string,
  req?: Request,
): Promise<boolean> {
  const id = (locationId || "").trim();
  if (!id) return false;

  // Master switch first — it already handles canary + the admin bypass.
  if (!(await hasPlaybookAccess(sb, id, req))) return false;

  const { data, error } = await sb
    .from("location_tool_access")
    .select("enabled")
    .eq("location_id", id)
    .eq("tool_key", OFFLINE_EVENT_KEY)
    .maybeSingle();
  // Fail OPEN on a read blip: the master switch already passed, so the safe
  // failure here is "let the paying customer book", not "silently break them".
  if (error) {
    console.error("offline-event sub-switch read failed (allowing):", error);
    return true;
  }

  if (data?.enabled === false) return req ? await isAdminRequest(req) : false;
  return true;
}

/**
 * Back-compat shim: the per-tool gate collapsed into the single Playbook switch,
 * so `toolKey` is accepted but IGNORED. Kept so any missed call site still gets
 * the correct (master-switch) answer rather than silently diverging.
 */
export async function hasToolAccess(
  sb: SupabaseClient,
  locationId: string,
  _toolKey: string,
  req?: Request,
): Promise<boolean> {
  return hasPlaybookAccess(sb, locationId, req);
}

/** Is the caller a signed-in platform admin? Never throws. */
async function isAdminRequest(req: Request): Promise<boolean> {
  try {
    return !!(await requireAdmin(req));
  } catch {
    return false;
  }
}
