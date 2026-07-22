// ════════════════════════════════════════════════════════════════════════
// Offline Event — Stripe WEBHOOK (`oe-stripe-webhook`).
//
// Called DIRECTLY by Stripe (not the browser), so verify_jwt is OFF at the
// gateway and the REAL gate is the Stripe SIGNATURE: constructEventAsync
// rejects anything not signed with our webhook secret. This is what makes
// "paid" server-verified and un-fakeable — the old app trusted the browser.
//
//   checkout.session.completed → pending booking becomes CONFIRMED (seats were
//                                 already held since checkout; store payment id
//                                 + receipt).
//   checkout.session.expired   → pending booking becomes CANCELLED and its seats
//                                 are RELEASED (booked_seats cascade-delete).
//
// Idempotent: every transition fires ONLY from `pending` (guarded in the UPDATE
// with .eq("status","pending")), so a duplicate delivery on an already-settled
// booking is a harmless no-op. Returns 400 ONLY on a bad signature; 200 on
// everything handled/ignored so Stripe stops retrying; 500 on a transient
// server error so Stripe retries (safe — handlers are idempotent).
// ════════════════════════════════════════════════════════════════════════
import { serviceClient } from "../_shared/ghl.ts";
import { resolveOeStripe } from "../_shared/stripe.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const res = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const ok = () => res({ received: true }, 200);

// deno-lint-ignore no-explicit-any
type SB = any;

async function findBooking(sb: SB, bookingUuid?: string, sessionId?: string) {
  const cols = "id, booking_id, status, stripe_session_id";
  if (bookingUuid) {
    const { data } = await sb.from("oe_bookings").select(cols).eq("id", bookingUuid).maybeSingle();
    if (data) return data;
  }
  if (sessionId) {
    const { data } = await sb.from("oe_bookings").select(cols).eq("stripe_session_id", sessionId).maybeSingle();
    if (data) return data;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return res({ error: "method_not_allowed" }, 405);

  const sig = req.headers.get("stripe-signature");
  const raw = await req.text(); // RAW body — required for signature verification
  if (!sig) return res({ error: "missing_signature" }, 400);

  const sb = serviceClient();

  let stripe;
  let webhookSecret = "";
  try {
    const cfg = await resolveOeStripe(sb);
    stripe = cfg.stripe;
    webhookSecret = cfg.webhookSecret;
  } catch (e) {
    console.error("oe-stripe-webhook config error:", e);
    return res({ error: "config" }, 500);
  }
  if (!webhookSecret) {
    console.error("oe-stripe-webhook: webhook secret not set for the current mode");
    return res({ error: "webhook_secret_missing" }, 500);
  }

  // deno-lint-ignore no-explicit-any
  let event: any;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, webhookSecret);
  } catch (e) {
    console.error("oe-stripe-webhook: signature verification failed:", e instanceof Error ? e.message : e);
    return res({ error: "invalid_signature" }, 400);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const bookingUuid: string | undefined = session?.metadata?.bookingId;
      const sessionId: string | undefined = session?.id;
      const paymentIntentId: string | undefined =
        typeof session?.payment_intent === "string" ? session.payment_intent : session?.payment_intent?.id;

      const booking = await findBooking(sb, bookingUuid, sessionId);
      if (!booking) {
        console.warn("oe-stripe-webhook: completed but booking not found", { bookingUuid, sessionId });
        return ok();
      }
      if (booking.status === "confirmed") return ok(); // idempotent replay
      if (booking.status === "cancelled") {
        // Paid AFTER expiry (near-impossible: Stripe won't fire completed after
        // expired for the same session). Flag for manual review; don't guess.
        console.warn("oe-stripe-webhook: payment for a cancelled booking (manual review):", booking.booking_id);
        return ok();
      }

      // Best-effort receipt URL (a nicety; never blocks confirmation).
      let receiptUrl: string | null = null;
      try {
        if (paymentIntentId) {
          const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
          const charge = pi?.latest_charge;
          receiptUrl = charge && typeof charge === "object" ? (charge.receipt_url ?? null) : null;
        }
      } catch (_e) { /* receipt is optional */ }

      const amount = session?.amount_total != null ? (Number(session.amount_total) / 100).toFixed(2) : "";
      const currency = String(session?.currency || "").toUpperCase();

      await sb
        .from("oe_bookings")
        .update({
          status: "confirmed",
          payment_intent_id: paymentIntentId ?? null,
          stripe_session_id: sessionId ?? booking.stripe_session_id,
          receipt_url: receiptUrl,
          payment_note: `Stripe ${amount} ${currency}`.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", booking.id)
        .eq("status", "pending"); // guard: only pending → confirmed, once
      return ok();
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      const booking = await findBooking(sb, session?.metadata?.bookingId, session?.id);
      if (!booking || booking.status !== "pending") return ok();
      // Release the held seats (frees them for other buyers), then cancel.
      await sb.from("oe_booked_seats").delete().eq("booking_id", booking.id);
      await sb
        .from("oe_bookings")
        .update({ status: "cancelled", payment_note: "Checkout expired", updated_at: new Date().toISOString() })
        .eq("id", booking.id)
        .eq("status", "pending");
      return ok();
    }

    return ok(); // ignore all other event types
  } catch (e) {
    console.error("oe-stripe-webhook handler error:", e);
    return res({ error: "handler" }, 500); // 500 → Stripe retries (idempotent-safe)
  }
});
