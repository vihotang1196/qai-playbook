// ════════════════════════════════════════════════════════════════════════
// Shared cross-tool usage logger. Any tool's edge fn calls this (service role)
// to record one usage event into tool_usage — the platform meter the Admin
// Portal reads. Best-effort + non-fatal: a logging failure must never break the
// user-facing action.
// ════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export async function logToolUsage(
  sb: SupabaseClient,
  event: {
    tool_key: string;
    event_type: string;
    location_id?: string | null;
    quantity?: number;
    meta?: Record<string, unknown>;
    /** Rate-limit dimension (see _shared/ratelimit.ts): "loc:…" / "qr:…" /
     *  "ip:…". Optional — omitting it only means this row won't be counted by
     *  checkRateLimit; existing callers are unaffected. */
    client_key?: string | null;
  },
): Promise<void> {
  try {
    await sb.from("tool_usage").insert({
      tool_key: event.tool_key,
      event_type: event.event_type,
      location_id: event.location_id ?? null,
      quantity: event.quantity ?? 1,
      meta: event.meta ?? null,
      client_key: event.client_key ?? null,
    });
  } catch (e) {
    console.error("logToolUsage failed (non-fatal):", e);
  }
}
