// ════════════════════════════════════════════════════════════════════════
// SHARED `ghl` edge function — the HTTP entry any tool's frontend calls to
// resolve GHL location context. The frontend passes a location_id (read from
// the URL) with the anon key; this function runs with the SERVICE ROLE so RLS
// stays strict and the frontend never touches tables directly.
//
// Every query is scoped by the request's location_id (see _shared/ghl.ts).
// ════════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  json,
  serviceClient,
  getLocation,
  listLocations,
} from "../_shared/ghl.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const sb = serviceClient();

    switch (action) {
      case "getLocation": {
        const location = await getLocation(sb, String(body?.locationId || ""));
        return json({ location });
      }
      case "listLocations": {
        // Agency picker — wired now, surfaced in the UI from Phase 3 (once the
        // GHL sync populates ghl_locations).
        const locations = await listLocations(sb);
        return json({ locations });
      }
      default:
        return json({ error: `Unknown action: ${action || "(none)"}` }, 400);
    }
  } catch (e) {
    console.error("ghl fn error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
