// ════════════════════════════════════════════════════════════════════════
// SHARED `ghl` edge function — the HTTP entry the CUSTOMER (sub-account) side
// calls to resolve ITS OWN location context. Callable with the public anon key
// (verify_jwt=false), so it exposes ONLY per-location lookup of the location_id
// the caller already has (from its GHL URL).
//
// ⚠️ Agency "god-view" operations (list ALL locations, toggle a location's
// access) are NOT here — they would leak every client's data to anyone holding
// the public anon key. They live in the future authenticated Admin Portal
// (real login + admin check). See _shared/ghl.ts (listLocations /
// setLocationEnabled stay there for that authenticated caller).
// ════════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, serviceClient, getLocation } from "../_shared/ghl.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const sb = serviceClient();

    switch (action) {
      case "getLocation": {
        // Customer resolves ITS OWN location (the location_id from its URL).
        const location = await getLocation(sb, String(body?.locationId || ""));
        return json({ location });
      }
      // NOTE: no listLocations / setEnabled here — those are agency-only and
      // must go through the authenticated Admin Portal, never this public fn.
      default:
        return json({ error: `Unknown action: ${action || "(none)"}` }, 400);
    }
  } catch (e) {
    console.error("ghl fn error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
