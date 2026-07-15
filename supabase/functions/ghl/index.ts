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
  setLocationEnabled,
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
        const locations = await listLocations(sb);
        return json({ locations });
      }
      case "setEnabled": {
        await setLocationEnabled(sb, String(body?.locationId || ""), !!body?.enabled);
        return json({ ok: true });
      }
      default:
        return json({ error: `Unknown action: ${action || "(none)"}` }, 400);
    }
  } catch (e) {
    console.error("ghl fn error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
