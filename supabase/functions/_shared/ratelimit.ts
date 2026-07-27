// ════════════════════════════════════════════════════════════════════════
// Shared rate limiter (pre-launch abuse/cost protection).
//
// ONE implementation every tool calls, counting rows in the existing tool_usage
// table — no bespoke per-tool counters, no second table. A tool records an event
// with logToolUsage({ client_key }) and asks checkRateLimit() before doing the
// expensive work (an LLM call, a Stripe session, a seat claim).
//
// DIMENSION: client_key, built with the helpers below —
//   locKey(locationId) → "loc:<id>"   the primary dimension. Every public
//                                      expensive endpoint requires a location_id,
//                                      so anonymous spam has no identity to spend.
//   qrKey(shortCode)   → "qr:<code>"  Review Boost's per-QR caps.
//   ipKey(req)         → "ip:<hash>"  optional secondary backstop.
//
// FAIL-OPEN on a DB error: the limiter must never be the reason a paying
// customer can't work. Every caller needs the same DB for its real job anyway,
// so a DB outage fails the request a moment later regardless. Errors are logged.
// ════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

/** One limit: at most `max` events within the trailing `windowMs`. */
export type RateWindow = { windowMs: number; max: number; label: string };

export type RateLimitResult = {
  allowed: boolean;
  /** The window that tripped (only when allowed === false). */
  limited?: RateWindow;
  /** Rough seconds until the caller should try again. */
  retryAfterSec?: number;
};

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/** Per sub-account — the primary throttling dimension. */
export function locKey(locationId: string): string {
  return `loc:${(locationId || "").trim()}`;
}

/** Per QR code (Review Boost). */
export function qrKey(shortCode: string): string {
  return `qr:${(shortCode || "").trim()}`;
}

/** Per client IP, hashed (never store a raw IP). Optional backstop dimension:
 *  keep IP limits generous — offices and mobile carriers share one address. */
export async function ipKey(req: Request): Promise<string> {
  const raw =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "";
  if (!raw) return "ip:unknown";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `ip:${hex.slice(0, 24)}`;
}

/**
 * Check every window for one (tool_key, client_key). Returns as soon as one
 * trips, so the common allowed path costs one COUNT per window (both are index
 * lookups on tool_usage_ratelimit_idx).
 *
 * `eventType` narrows the count to a single kind of event (e.g. only count
 * 'generation', not 'posted') — omit to count every event for that tool.
 */
export async function checkRateLimit(
  sb: SupabaseClient,
  opts: {
    toolKey: string;
    clientKey: string;
    windows: RateWindow[];
    eventType?: string;
  },
): Promise<RateLimitResult> {
  const { toolKey, clientKey, windows, eventType } = opts;
  if (!clientKey || !windows?.length) return { allowed: true };

  try {
    for (const w of windows) {
      const since = new Date(Date.now() - w.windowMs).toISOString();
      let q = sb
        .from("tool_usage")
        .select("id", { count: "exact", head: true })
        .eq("tool_key", toolKey)
        .eq("client_key", clientKey)
        .gte("created_at", since);
      if (eventType) q = q.eq("event_type", eventType);

      const { count, error } = await q;
      if (error) throw error;
      if ((count ?? 0) >= w.max) {
        return {
          allowed: false,
          limited: w,
          retryAfterSec: Math.ceil(w.windowMs / 1000),
        };
      }
    }
    return { allowed: true };
  } catch (e) {
    // Fail-open by design (see header).
    console.error("checkRateLimit failed (allowing request):", e);
    return { allowed: true };
  }
}

/** Bilingual over-limit copy. Tools render this as a normal, friendly message —
 *  never a red error — so a throttled customer is told to come back, not that
 *  something broke. */
export function rateLimitMessage(lang: "cn" | "en", scope: "hour" | "day" = "day"): string {
  if (lang === "en") {
    return scope === "hour"
      ? "You've reached this hour's usage limit. Please try again a little later — or contact our support team if it's urgent. 🙏"
      : "You've reached today's usage limit. Please try again tomorrow — or contact our support team if it's urgent. 🙏";
  }
  return scope === "hour"
    ? "这一小时的使用次数已达上限，请稍后再试；如果急需帮助，欢迎联系我们的支持团队 🙏"
    : "今天的使用次数已达上限，请明天再试；如果急需帮助，欢迎联系我们的支持团队 🙏";
}
