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

      // ── Per-sub-account preferences (tool-neutral, pb_subaccount_prefs) ──
      // The customer reads / sets ITS OWN default landing page (keyed by the
      // location_id it already has). Low-stakes UI preference; trust-the-URL.
      case "getSubaccountPrefs": {
        const id = String(body?.locationId || "").trim();
        if (!id) return json({ error: "location_required" }, 400);
        const { data } = await sb
          .from("pb_subaccount_prefs")
          .select("default_path")
          .eq("location_id", id)
          .maybeSingle();
        return json({ default_path: (data?.default_path as string) ?? null });
      }
      case "setSubaccountPrefs": {
        const id = String(body?.locationId || "").trim();
        if (!id) return json({ error: "location_required" }, 400);
        const raw = body?.default_path;
        const path = raw == null ? "" : String(raw).trim();
        // Empty → clear the override (revert to the system fallback).
        if (path === "") {
          await sb.from("pb_subaccount_prefs").delete().eq("location_id", id);
          return json({ ok: true, cleared: true });
        }
        // Only accept a safe in-app relative path (open-redirect hygiene): must
        // start with a single "/", no protocol-relative "//", bounded length.
        if (!path.startsWith("/") || path.startsWith("//") || path.length > 200) {
          return json({ error: "invalid_path" }, 400);
        }
        const { error } = await sb
          .from("pb_subaccount_prefs")
          .upsert(
            { location_id: id, default_path: path, updated_at: new Date().toISOString() },
            { onConflict: "location_id" },
          );
        if (error) throw error;
        return json({ ok: true });
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
