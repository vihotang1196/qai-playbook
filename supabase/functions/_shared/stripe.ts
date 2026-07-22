// ════════════════════════════════════════════════════════════════════════
// Shared Stripe helper (Deno edge functions).
//
// makeStripeClient() is tool-neutral. resolveOeStripe() is Offline-Event
// specific: it reads oe_settings.stripe_payment_mode (sandbox | live) and
// returns the matching secret key + webhook signing secret from the OE_STRIPE_*
// edge secrets. Keeping the "which secret for which mode" mapping in ONE place
// (this file) matters — it's the money path; a wrong/missing name must fail
// LOUDLY, never silently charge on the wrong account.
//
// Secrets (owner sets in Supabase → Edge Functions → Secrets; NEVER in code):
//   sandbox → OE_STRIPE_SECRET_KEY_TEST  + OE_STRIPE_WEBHOOK_SECRET_TEST
//   live    → OE_STRIPE_SECRET_KEY_LIVE  + OE_STRIPE_WEBHOOK_SECRET_LIVE
//
// We talk to Stripe DIRECTLY (unlike the old Lovable-gateway version) — a plain
// secret key + the Deno fetch HTTP client.
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

export type OeStripeConfig = {
  mode: OeStripeMode;
  secretKey: string;
  /** Empty string if the current mode's webhook secret isn't set yet. Callers
   *  that verify signatures MUST check this is non-empty. */
  webhookSecret: string;
  stripe: Stripe;
};

/** Resolve the active Offline-Event Stripe config from oe_settings + secrets. */
export async function resolveOeStripe(sb: SupabaseClient): Promise<OeStripeConfig> {
  const { data } = await sb
    .from("oe_settings")
    .select("value")
    .eq("key", "stripe_payment_mode")
    .maybeSingle();
  const mode: OeStripeMode = data?.value === "live" ? "live" : "sandbox";

  const keyName = mode === "live" ? "OE_STRIPE_SECRET_KEY_LIVE" : "OE_STRIPE_SECRET_KEY_TEST";
  const whName = mode === "live" ? "OE_STRIPE_WEBHOOK_SECRET_LIVE" : "OE_STRIPE_WEBHOOK_SECRET_TEST";

  const secretKey = Deno.env.get(keyName) ?? "";
  const webhookSecret = Deno.env.get(whName) ?? "";
  if (!secretKey) throw new Error(`${keyName} not configured`);

  return { mode, secretKey, webhookSecret, stripe: makeStripeClient(secretKey) };
}
