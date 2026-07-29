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

/**
 * What to assume when the canary flag CANNOT be read — a query error, a missing
 * row, or a `value` that is not the shape we store.
 *
 * Read from the ENVIRONMENT, not the database, on purpose. This is the value that
 * decides what happens when the database is the very thing we cannot trust, so it
 * must not need the database to answer. `Deno.env.get` is available synchronously
 * on a cold isolate and has no failure mode of its own.
 *
 * A "reuse the last good value" cache cannot cover this: a cold isolate has no
 * last good value, and at pre-launch traffic almost every request is cold.
 *
 *   deny (default) → treat an unreadable flag as WHITELIST mode: only sub-accounts
 *                    with an explicit enabled=true row get in.
 *   allow          → treat it as normal mode (the old behaviour).
 *
 * ⚠️ ON THE DAY THE PLAYBOOK OPENS TO EVERYONE: set CANARY_FALLBACK=allow **and
 * redeploy every function that imports this file** — Edge Function secrets are
 * injected at deploy time, so changing the value alone does nothing.
 *
 * Forgetting to flip it refuses some sub-accounts and someone complains within the
 * hour: loud, and fixable in one deploy. The old default failed the other way, and
 * nobody has ever reported "I got in when I should not have".
 */
function canaryFallback(): boolean {
  return (Deno.env.get("CANARY_FALLBACK") ?? "deny").trim().toLowerCase() !== "allow";
}

export async function isCanaryMode(sb: SupabaseClient): Promise<boolean> {
  const now = Date.now();
  if (canaryCache && now - canaryCache.at < CANARY_TTL_MS) return canaryCache.value;
  try {
    const { data, error } = await sb
      .from("platform_settings")
      .select("value")
      .eq("key", "canary_mode")
      .maybeSingle();

    // The error used to be dropped on the floor (`const { data }` alone). supabase-js
    // RETURNS query errors here rather than throwing, so the catch below never saw
    // them: a failed read looked exactly like "flag is off" → default-allow, cached
    // for the full TTL, not one line in the log. That is the failure nobody reports.
    if (error) {
      console.error("isCanaryMode: platform_settings read failed:", error.message);
      return canaryFallback();
    }
    // A MISSING ROW IS NOT "CANARY OFF" — it means the switch we gate on is gone
    // (deleted, renamed, or never seeded). maybeSingle returns data=null, error=null
    // for it, which is why this needs its own branch and its own log line. Same for
    // a `value` that is not `{ enabled: boolean }`: the shape changed under us, and
    // guessing "off" would silently open the platform.
    const value = data?.value as { enabled?: boolean } | null | undefined;
    if (!value || typeof value.enabled !== "boolean") {
      console.warn(
        "isCanaryMode: platform_settings.canary_mode is missing or malformed — using CANARY_FALLBACK",
      );
      return canaryFallback();
    }

    // Only a real, well-formed read is cached. A fallback must never stick for the
    // TTL: the next request should get another chance at the truth.
    canaryCache = { value: value.enabled, at: now };
    return value.enabled;
  } catch (e) {
    console.error("isCanaryMode: threw, using CANARY_FALLBACK:", e);
    return canaryFallback();
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
 * THE rule, in one place: given a sub-account's stored `playbook` value (or
 * null/undefined when it has no row) and the rollout flag, may it use the
 * Playbook?
 *
 *   no row  → whitelist mode denies (内测中), normal mode allows (已全面开放)
 *   row     → the row wins, in BOTH modes
 *
 * The row winning in both modes is what makes 「全部开启」 safe: flipping the
 * global flag never resurrects a sub-account the owner deliberately switched
 * off (a suspended customer must not quietly come back).
 *
 * Everything that answers "is this sub-account on?" MUST route through here —
 * the gate below, the admin list, and the Offline Event sub-account manager.
 * This used to be re-implemented in three places; when copies drift, the admin
 * UI shows a toggle that disagrees with what customers actually get, and an
 * admin can never notice because admins bypass the gate.
 */
export function playbookAllowed(row: boolean | null | undefined, whitelistMode: boolean): boolean {
  if (row === null || row === undefined) return !whitelistMode;
  return row !== false;
}

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

  // The ONE rule (playbookAllowed) — never re-implement it at a call site.
  // The flag is only looked up when there is no row, since that is the only
  // case it decides; a row answers on its own in either mode.
  const stored = data ? (data.enabled as boolean) : null;
  const granted =
    stored !== null ? playbookAllowed(stored, false) : playbookAllowed(null, await isCanaryMode(sb));
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
