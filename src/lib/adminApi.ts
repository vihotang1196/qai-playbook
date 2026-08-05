import { getSupabase } from "@/lib/supabase";
import type { ToolKey } from "@/lib/admin/tools";

// Admin Portal data API — wraps the `admin` edge fn (+ the now-locked
// sync-ghl-locations). functions.invoke auto-attaches the admin's session token;
// every action is re-verified server-side by requireAdmin. The frontend holds no
// privilege of its own.

async function callAdmin<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke("admin", { body: { action, ...payload } });
  if (error) {
    // Surface the server's {error} (e.g. not_authorized) when present.
    let msg = error instanceof Error ? error.message : "request failed";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const b = await ctx.json();
        if (b?.error) msg = String(b.error);
      }
    } catch {
      /* keep generic */
    }
    throw new Error(msg);
  }
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

export type AdminLocation = {
  location_id: string;
  business_name: string | null;
  logo_url: string | null;
  niche: string | null;
  access: Partial<Record<ToolKey, boolean>>; // absent = no explicit row
  /** Effective answer, COMPUTED SERVER-SIDE by the same helper the customer gate
   *  uses (_shared/access.ts `playbookAllowed`). Never re-derive it here. */
  playbook_enabled: boolean;
};

export type AdminAuditEntry = {
  id: string;
  admin_email: string | null;
  action: string;
  target_location_id: string | null;
  tool_key: string | null;
  detail: { from?: boolean; to?: boolean; total?: number } | null;
  created_at: string;
  business_name: string | null;
};

/** The reserved key holding the ONE master switch (mirrors PLAYBOOK_KEY in
 *  supabase/functions/_shared/access.ts). The Playbook is one product, so access
 *  is a single on/off per sub-account rather than a per-tool matrix. */
export const PLAYBOOK_KEY = "playbook";

/** `whitelistMode` = 内测中 (no row → denied). The server sends it so the UI can
 *  describe the current rollout state; the per-row answer is already computed. */
export async function listLocations(
  query = "",
  limit = 50,
): Promise<{ locations: AdminLocation[]; total: number | null; capped: boolean; whitelistMode: boolean }> {
  return callAdmin("listLocations", { query, limit });
}

/** Turn the whole Playbook on/off for one sub-account (the only access switch). */
export async function setPlaybookAccess(location_id: string, enabled: boolean): Promise<void> {
  await callAdmin("setPlaybookAccess", { location_id, enabled });
}

export type PlaybookRoster = {
  /** Explicitly switched ON — in 内测中 this IS the whitelist. */
  on: { location_id: string; business_name: string | null }[];
  /** Explicitly switched OFF — stays off even after 全部开启. */
  off: { location_id: string; business_name: string | null }[];
};

/** Who has an explicit Playbook row, so the rollout card can name them. */
export async function listPlaybookRoster(): Promise<PlaybookRoster> {
  const r = await callAdmin<PlaybookRoster>("listPlaybookRoster", {});
  return { on: r.on ?? [], off: r.off ?? [] };
}

/** Platform-wide rollout state. `enabled` = 内测中 (whitelist: only sub-accounts
 *  explicitly switched on get in). `false` = 已全面开放 (everyone except those
 *  switched off). Admins always pass, either way.
 *
 *  The stored key is still `canary_mode`: renaming it would need a migration,
 *  and any moment where the flag reads as absent fails OPEN — which pre-launch
 *  would let all 911 sub-accounts in at once. Not worth it for a name nobody
 *  outside this file sees. */
export async function getRolloutMode(): Promise<{ whitelistMode: boolean; updated_at: string | null }> {
  const r = await callAdmin<{ enabled: boolean; updated_at: string | null }>("getCanaryMode", {});
  return { whitelistMode: !!r.enabled, updated_at: r.updated_at ?? null };
}

/** `whitelistMode: false` = 全部开启. Does NOT touch per-sub-account rows, so a
 *  deliberately switched-off customer stays off. */
export async function setRolloutMode(whitelistMode: boolean): Promise<void> {
  await callAdmin("setCanaryMode", { enabled: whitelistMode });
}

export async function listAudit(limit = 100): Promise<AdminAuditEntry[]> {
  const { audit } = await callAdmin<{ audit: AdminAuditEntry[] }>("listAudit", { limit });
  return audit || [];
}

/** One Coaching Night session. `replay_url` null = scheduled, no recording yet
 *  (step 2); only rows WITH one show on the homepage's 「过往录像」. */
export type CoachingSession = {
  id: string;
  /** YYYY-MM-DD (a DATE column — no time, no timezone). */
  session_date: string;
  topic: string;
  replay_url: string | null;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
};

/** Every session, newest first — including replay-less ones, unlike the public
 *  `coaching` fn which only returns rows that have a recording. */
export async function listCoachingSessions(): Promise<CoachingSession[]> {
  const { sessions } = await callAdmin<{ sessions: CoachingSession[] }>("listCoachingSessions");
  return sessions || [];
}

/** Create (no id) or update one session. Live immediately on the homepage. */
export async function saveCoachingSession(payload: {
  id?: string;
  session_date: string;
  topic?: string;
  replay_url?: string | null;
  cover_url?: string | null;
}): Promise<string> {
  const { id } = await callAdmin<{ id: string }>("saveCoachingSession", payload);
  return id;
}

export async function deleteCoachingSession(id: string): Promise<void> {
  await callAdmin("deleteCoachingSession", { id });
}

export type AdminUsageStats = {
  totals: { generations: number; posted: number; activeSubAccounts: number };
  byTool: { tool_key: string; count: number }[];
  topSubAccounts: { location_id: string; business_name: string | null; count: number }[];
  daily: { date: string; count: number }[];
};

/** Cross-tool usage overview (from tool_usage). Scoped to admins server-side. */
export async function getUsageStats(): Promise<AdminUsageStats> {
  const { stats } = await callAdmin<{ stats: AdminUsageStats }>("getUsageStats");
  return stats;
}

/** Trigger a GHL sub-account sync (now admin-gated). */
export async function syncLocations(): Promise<number> {
  const { data, error } = await getSupabase().functions.invoke("sync-ghl-locations", { body: {} });
  if (error) throw new Error("同步失败（需要管理员权限）");
  return (data as { total?: number })?.total ?? 0;
}
