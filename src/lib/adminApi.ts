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
  access: Partial<Record<ToolKey, boolean>>; // absent = default-allow
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

/** True unless explicitly disabled (default-allow). */
export function isToolEnabled(loc: AdminLocation, tool: ToolKey): boolean {
  return loc.access?.[tool] !== false;
}

export async function listLocations(
  query = "",
  limit = 50,
): Promise<{ locations: AdminLocation[]; total: number | null; capped: boolean }> {
  return callAdmin("listLocations", { query, limit });
}

export async function setToolAccess(location_id: string, tool_key: ToolKey, enabled: boolean): Promise<void> {
  await callAdmin("setToolAccess", { location_id, tool_key, enabled });
}

export async function listAudit(limit = 100): Promise<AdminAuditEntry[]> {
  const { audit } = await callAdmin<{ audit: AdminAuditEntry[] }>("listAudit", { limit });
  return audit || [];
}

/** Trigger a GHL sub-account sync (now admin-gated). */
export async function syncLocations(): Promise<number> {
  const { data, error } = await getSupabase().functions.invoke("sync-ghl-locations", { body: {} });
  if (error) throw new Error("同步失败（需要管理员权限）");
  return (data as { total?: number })?.total ?? 0;
}
