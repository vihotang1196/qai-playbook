import { getSupabase } from "@/lib/supabase";

// Helpdesk admin data API — wraps the `helpdesk-admin` edge fn. functions.invoke
// auto-attaches the admin's session token; every action is re-verified
// server-side by requireAdmin (→ platform_admins allowlist). The frontend holds
// no privilege of its own and never touches hd_ tables directly.

async function callHelpdesk<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke("helpdesk-admin", { body: { action, ...payload } });
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

export type HelpdeskOverview = {
  counts: {
    articles: number;
    folders: number;
    conversations: number;
    faq: number;
    updates: number;
  };
  notion: { connected: boolean; databases: number };
};

/** Live overview counts for the shared help center. Admin-only (server-enforced). */
export async function getOverview(): Promise<HelpdeskOverview> {
  const { overview } = await callHelpdesk<{ overview: HelpdeskOverview }>("overview");
  return overview;
}
