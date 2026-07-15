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
      default:
        return json({ error: `Unknown action: ${action || "(none)"}` }, 400);
    }
  } catch (e) {
    console.error("rb fn error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
