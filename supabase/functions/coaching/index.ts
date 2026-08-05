// ════════════════════════════════════════════════════════════════════════
// Coaching Night PUBLIC read API — the Playbook homepage reads the past-replay
// list through here.
//
// coaching_sessions is RLS-locked (service-role only), so the frontend can NOT
// read it directly. This anon-callable function runs with the service role
// internally and exposes ONE read-only action:
//   listReplays — past sessions that HAVE a recording, newest first
//
// Read-only by design: no writes, no secrets returned, and NO per-location
// scoping or access gate — Coaching Night is homepage content that every
// sub-account sees, so there is no "who may open it" question to answer. The
// requireAdmin-gated `admin` fn stays the only WRITE path.
//
// Contrast:
//   coaching (this) — public READS of the replay list (the homepage)
//   admin           — requireAdmin-gated coaching_sessions CRUD (back office)
//
// RESPONSE CONTRACT — the caller MUST be able to tell "function is down" from
// "genuinely zero replays", because the homepage falls back to a stale
// hardcoded snapshot in the first case and shows an empty state in the second:
//   ok    → 200 { replays: [...] }   (empty is still 200 { replays: [] })
//   error → non-200 { error }
// ════════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, serviceClient } from "../_shared/ghl.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();
    const sb = serviceClient();

    switch (action) {
      // Past Coaching Night replays for the homepage. `replay_url is not null`
      // is what makes a row "past" — rows without one are scheduled sessions
      // (step 2) and must never surface here.
      case "listReplays": {
        const { data, error } = await sb
          .from("coaching_sessions")
          .select("id, session_date, topic, replay_url, cover_url")
          .not("replay_url", "is", null)
          .order("session_date", { ascending: false })
          .limit(100);
        if (error) throw error;
        return json({ replays: data || [] });
      }

      default:
        return json({ error: `unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("coaching (public) error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
