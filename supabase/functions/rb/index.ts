// ════════════════════════════════════════════════════════════════════════
// Review Boost CUSTOMER-scoped data function.
//
// Callable with the public anon key (the sub-account app has no login). EVERY
// action REQUIRES a location_id (from the caller's GHL URL) and scopes every
// query to it with `.eq("location_id", …)`. So a caller can only read/write the
// ONE location in their URL — never list across locations or touch others en
// masse. (Cross-client/agency operations live in the authenticated Admin Portal,
// never here.)
// ════════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, serviceClient } from "../_shared/ghl.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Campaign columns returned to the customer app (all its own; no cross-location
// data). rb_qr_codes is embedded so the list/detail get the scan short-code.
const CAMPAIGN_COLS =
  "id, location_id, name, platform, integration_id, business_name, industry, category, " +
  "signature_features, logo_url, thank_you_mode, thank_you_message, redirect_url, " +
  "is_active, created_at, updated_at, rb_qr_codes(id, short_code, scan_count, is_active)";

// Unambiguous short-code alphabet (no l/o/0/1) for the /scan/<code> URL.
const CODE_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

function randomCode(len = 7): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** Insert a QR row with a fresh unique short_code (retry on the rare collision). */
async function createUniqueQr(
  sb: SupabaseClient,
  campaignId: string,
  locationId: string,
): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode(7);
    const { data, error } = await sb
      .from("rb_qr_codes")
      .insert({ campaign_id: campaignId, location_id: locationId, short_code: code })
      .select("short_code")
      .single();
    if (!error && data) return data.short_code as string;
    // 23505 = unique_violation → the code already exists, try another.
    if (error && (error as { code?: string }).code !== "23505") throw error;
  }
  throw new Error("Could not generate a unique short code");
}

/** Defence-in-depth: a campaign may only point at a platform link of its OWN location. */
async function integrationBelongsToLocation(
  sb: SupabaseClient,
  integrationId: string,
  locationId: string,
): Promise<boolean> {
  const { data, error } = await sb
    .from("rb_platform_integrations")
    .select("id")
    .eq("id", integrationId)
    .eq("location_id", locationId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const locationId = String(body?.locationId || "").trim();
    if (!locationId) return json({ error: "locationId required" }, 400);

    const sb = serviceClient();

    switch (action) {
      // ── Platforms (rb_platform_integrations) — links only, per platform ──
      case "listPlatforms": {
        const { data, error } = await sb
          .from("rb_platform_integrations")
          .select("id, platform, review_url, is_enabled")
          .eq("location_id", locationId)
          .order("platform", { ascending: true });
        if (error) throw error;
        return json({ platforms: data ?? [] });
      }
      case "savePlatform": {
        const platform = String(body?.platform || "").trim();
        if (!platform) return json({ error: "platform required" }, 400);
        const review_url = body?.review_url ? String(body.review_url).trim() : null;
        const is_enabled = !!body?.is_enabled;
        const { data, error } = await sb
          .from("rb_platform_integrations")
          .upsert(
            { location_id: locationId, platform, review_url, is_enabled },
            { onConflict: "location_id,platform" },
          )
          .select("id, platform, review_url, is_enabled")
          .single();
        if (error) throw error;
        return json({ platform: data });
      }
      case "deletePlatform": {
        const platform = String(body?.platform || "").trim();
        if (!platform) return json({ error: "platform required" }, 400);
        const { error } = await sb
          .from("rb_platform_integrations")
          .delete()
          .eq("location_id", locationId)
          .eq("platform", platform);
        if (error) throw error;
        return json({ ok: true });
      }

      // ── Campaigns (rb_campaigns) — each carries its OWN business info + a
      //    reference to one platform config (integration_id → the review link).
      case "listCampaigns": {
        const { data, error } = await sb
          .from("rb_campaigns")
          .select(CAMPAIGN_COLS)
          .eq("location_id", locationId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json({ campaigns: data ?? [] });
      }
      case "getCampaign": {
        const id = String(body?.id || "").trim();
        if (!id) return json({ error: "id required" }, 400);
        const { data, error } = await sb
          .from("rb_campaigns")
          .select(CAMPAIGN_COLS)
          .eq("location_id", locationId)
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return json({ campaign: data ?? null });
      }
      case "saveCampaign": {
        const id = body?.id ? String(body.id).trim() : null;
        const name = String(body?.name || "").trim();
        if (!name) return json({ error: "name required" }, 400);

        const integration_id = body?.integration_id ? String(body.integration_id).trim() : null;
        if (integration_id && !(await integrationBelongsToLocation(sb, integration_id, locationId))) {
          return json({ error: "integration not found for this location" }, 400);
        }

        const fields = {
          name,
          platform: body?.platform ? String(body.platform).trim() : "google",
          integration_id,
          business_name: body?.business_name ? String(body.business_name).trim() : null,
          industry: body?.industry ? String(body.industry).trim() : null,
          category: body?.category ? String(body.category).trim() : null,
          signature_features: Array.isArray(body?.signature_features)
            ? (body.signature_features as unknown[]).map((f) => String(f).trim()).filter(Boolean)
            : [],
          logo_url: body?.logo_url ? String(body.logo_url).trim() : null,
          thank_you_mode: body?.thank_you_mode === "url" ? "url" : "message",
          thank_you_message: body?.thank_you_message ? String(body.thank_you_message) : null,
          redirect_url: body?.redirect_url ? String(body.redirect_url).trim() : null,
          is_active: body?.is_active === undefined ? true : !!body.is_active,
        };

        if (id) {
          // UPDATE — scoped to this location; a foreign id simply matches nothing.
          const { data, error } = await sb
            .from("rb_campaigns")
            .update(fields)
            .eq("location_id", locationId)
            .eq("id", id)
            .select(CAMPAIGN_COLS)
            .maybeSingle();
          if (error) throw error;
          if (!data) return json({ error: "Campaign not found" }, 404);
          return json({ campaign: data });
        }

        // CREATE — insert the campaign, then mint its scan short-code.
        const { data: created, error: createErr } = await sb
          .from("rb_campaigns")
          .insert({ location_id: locationId, ...fields })
          .select("id")
          .single();
        if (createErr) throw createErr;

        await createUniqueQr(sb, created.id as string, locationId);

        const { data: full, error: fullErr } = await sb
          .from("rb_campaigns")
          .select(CAMPAIGN_COLS)
          .eq("location_id", locationId)
          .eq("id", created.id)
          .single();
        if (fullErr) throw fullErr;
        return json({ campaign: full });
      }
      case "deleteCampaign": {
        const id = String(body?.id || "").trim();
        if (!id) return json({ error: "id required" }, 400);
        // FK cascades remove this campaign's rb_qr_codes + rb_generations.
        const { error } = await sb
          .from("rb_campaigns")
          .delete()
          .eq("location_id", locationId)
          .eq("id", id);
        if (error) throw error;
        return json({ ok: true });
      }

      // ── Generations (rb_generations) — a campaign's AI-review history.
      //    Empty until the scan flow (Phase 7) starts writing rows.
      case "listGenerations": {
        const campaignId = String(body?.campaignId || "").trim();
        if (!campaignId) return json({ error: "campaignId required" }, 400);
        const { data, error } = await sb
          .from("rb_generations")
          .select("id, review_text, persona, rating, posted, created_at")
          .eq("location_id", locationId)
          .eq("campaign_id", campaignId)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        return json({ generations: data ?? [] });
      }

      default:
        return json({ error: `Unknown action: ${action || "(none)"}` }, 400);
    }
  } catch (e) {
    console.error("rb fn error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
