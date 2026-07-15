// ════════════════════════════════════════════════════════════════════════
// SHARED `sync-ghl-locations` edge function — pulls all sub-account locations
// from GoHighLevel into the shared `ghl_locations` table. One syncer for the
// whole project (copywriter / Review Boost / Offline Event all read the result).
//
// Auth to GHL: the PIT in GHL_AGENCY_API_KEY (Bearer, v2 leadconnectorhq API,
// Version 2021-07-28). companyId = GHL_COMPANY_ID if set, else decoded from the
// PIT. Runs with the Supabase service role. See _shared/ghl.ts.
// ════════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, serviceClient, syncGhlLocations } from "../_shared/ghl.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = serviceClient();
    const result = await syncGhlLocations(sb);
    return json({ success: true, total: result.total });
  } catch (e) {
    console.error("sync-ghl-locations error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
