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
import { hasToolAccess } from "../_shared/access.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Campaign columns returned to the customer app (all its own; no cross-location
// data). rb_qr_codes is embedded so the list/detail get the scan short-code.
const CAMPAIGN_COLS =
  "id, location_id, name, platform, integration_id, business_name, industry, category, " +
  "signature_features, logo_url, thank_you_mode, thank_you_message, redirect_url, " +
  "is_active, created_at, updated_at, " +
  "rb_qr_codes(id, short_code, scan_count, is_active), " +
  // The specific platform link this campaign points at (name + url), so the
  // detail page can show "→ Google Maps · 美容院-总店" at a glance.
  "integration:rb_platform_integrations(id, platform, label, review_url)";

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

    // Admin Portal access gate — if RB is disabled for this location, block the
    // WHOLE customer app (management + scan). Default-allow (no row = allowed).
    if (!(await hasToolAccess(sb, locationId, "review_boost", req))) {
      return json({ error: "tool_disabled" }, 403);
    }

    switch (action) {
      // Cheap probe the RB shell calls to decide whether to render or show the
      // "not available" block — reaches here only when access is allowed.
      case "access":
        return json({ ok: true });

      // ── Platform links (rb_platform_integrations) — MANY per platform now,
      //    each an optional-named review link. "Has a link" = usable; no toggle.
      case "listPlatforms": {
        const { data, error } = await sb
          .from("rb_platform_integrations")
          .select("id, platform, review_url, label, created_at")
          .eq("location_id", locationId)
          .order("platform", { ascending: true })
          .order("created_at", { ascending: true });
        if (error) throw error;
        return json({ platforms: data ?? [] });
      }
      case "savePlatformLink": {
        // id present = edit that link; absent = add a new link to a platform.
        const linkId = body?.id ? String(body.id).trim() : null;
        const review_url = body?.review_url ? String(body.review_url).trim() : "";
        const labelVal = body?.label ? String(body.label).trim() : null;
        if (!review_url) return json({ error: "review_url required" }, 400);

        if (linkId) {
          const { data, error } = await sb
            .from("rb_platform_integrations")
            .update({ review_url, label: labelVal })
            .eq("location_id", locationId)
            .eq("id", linkId)
            .select("id, platform, review_url, label")
            .maybeSingle();
          if (error) throw error;
          if (!data) return json({ error: "Link not found" }, 404);
          return json({ platform: data });
        }

        const platform = String(body?.platform || "").trim();
        if (!platform) return json({ error: "platform required" }, 400);
        const { data, error } = await sb
          .from("rb_platform_integrations")
          .insert({ location_id: locationId, platform, review_url, label: labelVal })
          .select("id, platform, review_url, label")
          .single();
        if (error) throw error;
        return json({ platform: data });
      }
      case "deletePlatformLink": {
        // Delete one link by its id. A campaign pointing at it keeps existing —
        // the integration_id FK is ON DELETE SET NULL (campaign just needs
        // re-pointing).
        const linkId = String(body?.id || "").trim();
        if (!linkId) return json({ error: "id required" }, 400);
        const { error } = await sb
          .from("rb_platform_integrations")
          .delete()
          .eq("location_id", locationId)
          .eq("id", linkId);
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

      // ── Dashboard stats (this location only) ──────────────────────────
      // Headline totals use COUNT queries (never truncated by row caps).
      // The 30-day trend fetches recent rb_generations timestamps and buckets
      // them by day — accurate up to ~1000 scans/30d (see PROGRESS pre-scale
      // TODO: move to a SQL group-by RPC before high volume).
      case "getStats": {
        const [campsRes, qrsRes, genCountRes, postedCountRes] = await Promise.all([
          sb.from("rb_campaigns").select("id, name, platform").eq("location_id", locationId).order("created_at", { ascending: true }),
          sb.from("rb_qr_codes").select("campaign_id, scan_count").eq("location_id", locationId),
          sb.from("rb_generations").select("id", { count: "exact", head: true }).eq("location_id", locationId),
          sb.from("rb_generations").select("id", { count: "exact", head: true }).eq("location_id", locationId).eq("posted", true),
        ]);
        if (campsRes.error) throw campsRes.error;
        if (qrsRes.error) throw qrsRes.error;
        const campaigns = campsRes.data ?? [];
        const qrs = qrsRes.data ?? [];

        const scansByCampaign: Record<string, number> = {};
        let totalScans = 0;
        for (const q of qrs) {
          const n = (q.scan_count as number) || 0;
          scansByCampaign[q.campaign_id as string] = (scansByCampaign[q.campaign_id as string] || 0) + n;
          totalScans += n;
        }

        // Posted per campaign (parallel count queries — cap-free).
        const postedByCampaign: Record<string, number> = {};
        await Promise.all(
          campaigns.map(async (c) => {
            const { count } = await sb
              .from("rb_generations")
              .select("id", { count: "exact", head: true })
              .eq("location_id", locationId)
              .eq("campaign_id", c.id)
              .eq("posted", true);
            postedByCampaign[c.id as string] = count ?? 0;
          }),
        );

        const perCampaign = campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          platform: c.platform,
          scans: scansByCampaign[c.id as string] ?? 0,
          posted: postedByCampaign[c.id as string] ?? 0,
        }));

        // 30-day daily trend from rb_generations timestamps (1 gen = 1 scan).
        const since = new Date(Date.now() - 30 * 86_400_000);
        since.setUTCHours(0, 0, 0, 0);
        const { data: recent, error: recentErr } = await sb
          .from("rb_generations")
          .select("created_at")
          .eq("location_id", locationId)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: true });
        if (recentErr) throw recentErr;
        const dayMap: Record<string, number> = {};
        for (const r of recent ?? []) {
          const key = String(r.created_at).slice(0, 10);
          dayMap[key] = (dayMap[key] || 0) + 1;
        }
        const daily: { date: string; scans: number }[] = [];
        for (let i = 29; i >= 0; i--) {
          const key = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
          daily.push({ date: key, scans: dayMap[key] || 0 });
        }

        return json({
          stats: {
            totals: { scans: totalScans, posted: postedCountRes.count ?? 0, generations: genCountRes.count ?? 0 },
            perCampaign,
            daily,
          },
        });
      }

      default:
        return json({ error: `Unknown action: ${action || "(none)"}` }, 400);
    }
  } catch (e) {
    console.error("rb fn error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
