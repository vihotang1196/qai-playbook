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
  const { data } = await sb
    .from("oe_settings")
    .select("value")
    .eq("key", "stripe_payment_mode")
    .maybeSingle();
  const mode: OeStripeMode = data?.value === "live" ? "live" : "sandbox";

  const { name, key } = platformStripeSecret(mode);
  if (!key) throw new Error(`Stripe secret not configured: ${name}`);

  return { mode, secretKey: key, webhookSecret: platformWebhookSecret(mode), stripe: makeStripeClient(key) };
}
