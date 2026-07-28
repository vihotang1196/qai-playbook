// ════════════════════════════════════════════════════════════════════════
// Shared Stripe helper (Deno edge functions).
//
// ARCHITECTURE (owner decision 2026-07-22):
//   • Stripe KEYS are PLATFORM-LEVEL — ONE Stripe account, ONE set of test/live
//     secrets, shared by every tool. Set them ONCE in Supabase secrets; you do
//     NOT configure Stripe per tool.
//   • Each TOOL has its OWN independent test/live MODE switch (Offline Event's
//     lives in oe_settings.stripe_payment_mode). So Offline Event can be LIVE
//     (collecting real money) while a brand-new tool is still in TEST — flipping
//     one tool's mode never touches another's. A future tool gets its own mode
//     row + its own resolve*Stripe() that reuses these same platform keys.
//
// Platform secrets (owner sets in Supabase → Edge Functions → Secrets):
//   test → STRIPE_SECRET_KEY_TEST  + STRIPE_WEBHOOK_SECRET_TEST
//   live → STRIPE_SECRET_KEY_LIVE  + STRIPE_WEBHOOK_SECRET_LIVE
// Back-compat: if a platform name isn't set we fall back to the legacy
// OE_STRIPE_SECRET_KEY_* / OE_STRIPE_WEBHOOK_SECRET_* names, so the existing
// setup keeps working until the platform-level names are configured.
//
// We talk to Stripe DIRECTLY (a plain secret key + the Deno fetch HTTP client).
// The "which secret for which mode" mapping lives ONLY here — it's the money
// path; a wrong/missing name must fail LOUDLY, never silently charge wrong.
// ════════════════════════════════════════════════════════════════════════
import Stripe from "https://esm.sh/stripe@22.0.2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export type OeStripeMode = "sandbox" | "live";

/** A Stripe client wired for the Deno runtime (fetch-based HTTP). */
export function makeStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: "2026-03-25.dahlia",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

// ── Platform-level key resolution (tool-neutral) ──────────────────────────
const env = (n: string) => Deno.env.get(n) ?? "";

/** Platform Stripe secret key for a mode (platform name, else legacy OE_ name). */
export function platformStripeSecret(mode: OeStripeMode): { name: string; key: string } {
  const platform = mode === "live" ? "STRIPE_SECRET_KEY_LIVE" : "STRIPE_SECRET_KEY_TEST";
  const legacy = mode === "live" ? "OE_STRIPE_SECRET_KEY_LIVE" : "OE_STRIPE_SECRET_KEY_TEST";
  return { name: `${platform} (or ${legacy})`, key: env(platform) || env(legacy) };
}

/** Platform Stripe webhook signing secret for a mode ("" if unset). */
export function platformWebhookSecret(mode: OeStripeMode): string {
  const platform = mode === "live" ? "STRIPE_WEBHOOK_SECRET_LIVE" : "STRIPE_WEBHOOK_SECRET_TEST";
  const legacy = mode === "live" ? "OE_STRIPE_WEBHOOK_SECRET_LIVE" : "OE_STRIPE_WEBHOOK_SECRET_TEST";
  return env(platform) || env(legacy);
}

/** Is the platform LIVE secret configured? (platform name or legacy OE_ name) */
export function platformLiveKeyConfigured(): boolean {
  return !!platformStripeSecret("live").key;
}

export type OeStripeConfig = {
  mode: OeStripeMode;
  secretKey: string;
  /** Empty string if the current mode's webhook secret isn't set yet. Callers
   *  that verify signatures MUST check this is non-empty. */
  webhookSecret: string;
  stripe: Stripe;
};

/**
 * Resolve the active Offline-Event Stripe config: OE's OWN mode (from
 * oe_settings.stripe_payment_mode) selects which PLATFORM key to use. Other
 * tools would have their own mode source but reuse the same platform keys.
 */
export async function resolveOeStripe(sb: SupabaseClient): Promise<OeStripeConfig> {
  const mode = await resolveOeMode(sb);

  const { name, key } = platformStripeSecret(mode);
  if (!key) throw new Error(`Stripe secret not configured: ${name}`);

  return { mode, secretKey: key, webhookSecret: platformWebhookSecret(mode), stripe: makeStripeClient(key) };
}

/** THE single source of truth for "which mode is Offline Event in". Read live
 *  from the DB on every call — never cached, so a mode switch takes effect on
 *  the very next charge. */
async function resolveOeMode(sb: SupabaseClient): Promise<OeStripeMode> {
  const { data } = await sb
    .from("oe_settings")
    .select("value")
    .eq("key", "stripe_payment_mode")
    .maybeSingle();
  return data?.value === "live" ? "live" : "sandbox";
}

export type ActiveStripeInfo = {
  /** The mode a charge created RIGHT NOW would use. */
  mode: OeStripeMode;
  /** Identifying prefix of the ACTUAL secret that would be used, e.g. "sk_live_"
   *  — never the key itself. Empty when the key isn't configured. */
  keyPrefix: string;
  /** False = a charge would FAIL (the mode's secret isn't set). */
  configured: boolean;
  /** Which secret name(s) were looked up, for a precise error message. */
  secretName: string;
};

/**
 * Describe what the money path would ACTUALLY do right now, for display.
 *
 * Deliberately built on the SAME mode lookup + key lookup that resolveOeStripe
 * uses, so the badge in the admin can never drift from the key a real charge
 * gets: if this says sk_live_, the next Checkout session is real money.
 * Returns only the key's prefix — the secret itself never leaves the server.
 */
export async function describeActiveStripe(sb: SupabaseClient): Promise<ActiveStripeInfo> {
  const mode = await resolveOeMode(sb);
  const { name, key } = platformStripeSecret(mode);
  return {
    mode,
    keyPrefix: key ? key.slice(0, 8) : "",
    configured: !!key,
    secretName: name,
  };
}
