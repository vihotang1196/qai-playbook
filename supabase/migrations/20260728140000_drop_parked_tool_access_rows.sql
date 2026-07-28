-- ════════════════════════════════════════════════════════════════════════
-- Clear the DORMANT per-tool access rows (2026-07-28, owner-approved).
--
-- Access collapsed into ONE `playbook` master switch (commit a640a20). The
-- older per-tool keys (review_boost / copywriter / helpdesk / offline_event)
-- were left in the table but are no longer consulted — so the rows written
-- before that change are asleep, not gone.
--
-- That is a trap: re-activating any of those keys (Offline Event is about to
-- get its own sub-switch) silently applies year-old test toggles to real
-- customers. A full scan found exactly 8 such rows across 2 sub-accounts —
-- including `offline_event = false` on the real client "Ong pei shirl", which
-- would have blocked their booking the moment the key woke up.
--
-- So: drop every non-`playbook` row. Nothing is lost — with the sub-switch's
-- default-allow semantics, "no row" means the same thing the owner wants
-- ("this customer can book"), and the master `playbook` rows are untouched.
-- Any future opt-out is written fresh from the admin UI, deliberately.
-- ════════════════════════════════════════════════════════════════════════

delete from public.location_tool_access
 where tool_key <> 'playbook';
