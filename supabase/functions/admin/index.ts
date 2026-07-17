// ════════════════════════════════════════════════════════════════════════
// Admin Portal edge function (platform-wide, all tools).
//
// EVERY action is gated by requireAdmin() first — validates the caller's session
// JWT + checks the platform_admins allowlist, before any privileged work runs
// with the service role. Callable with the public anon key (verify_jwt off at
// the gateway) because requireAdmin is the real, server-enforced gate.
//
// Step A ships `whoami` only. Step B adds the god-view (list sub-accounts,
// per-tool access toggles, audit) as more actions here.
// ════════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json } from "../_shared/ghl.ts";
import { requireAdmin } from "../_shared/admin.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = await requireAdmin(req);
    if (!admin) return json({ error: "not_authorized" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    switch (action) {
      case "whoami":
        return json({ admin });
      default:
        return json({ error: `Unknown action: ${action || "(none)"}` }, 400);
    }
  } catch (e) {
    console.error("admin fn error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
