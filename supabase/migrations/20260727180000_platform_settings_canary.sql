-- ════════════════════════════════════════════════════════════════════════
-- Platform settings + CANARY (whitelist) rollout mode.
--
-- ADDITIVE ONLY: one new table plus one seeded row. Nothing existing is dropped
-- or altered; location_tool_access, the hd_/oe_/rb_ tables and every tool are
-- untouched by this migration.
--
-- WHY: going live gradually. `hasToolAccess` is DEFAULT-ALLOW (no row for a
-- location = that tool is usable), which is right for steady state but wrong for
-- a canary launch, where only a hand-picked sub-account should get in. Canary
-- mode INVERTS that default to deny, turning location_tool_access into a
-- whitelist. It must be switchable back with one click — hence a stored flag
-- rather than a hard-coded constant.
--
-- WHY A TABLE (not an env var / constant): the owner flips this himself from the
-- Admin Portal, with no CLI and no redeploy. Edge functions read it through a
-- short-lived in-instance cache so the extra lookup costs almost nothing.
--
-- SEEDED OFF on purpose: creating the table must not change behaviour. The owner
-- turns canary on from the Admin Portal once the whitelist is set up.
--
-- SECURITY: RLS ON with NO policy → service role only, like every other
-- platform table. Only the requireAdmin-gated `admin` fn writes it; tools read
-- it with the service role.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.platform_settings (
  key         text primary key,          -- e.g. canary_mode
  value       jsonb not null,            -- e.g. {"enabled": true}
  updated_at  timestamptz not null default now(),
  updated_by  uuid                       -- the admin (auth.users id) who last changed it
);

alter table public.platform_settings enable row level security;
-- No policy on purpose → service role only.

-- Seed the flag OFF so this migration is behaviour-neutral.
insert into public.platform_settings (key, value)
values ('canary_mode', '{"enabled": false}'::jsonb)
on conflict (key) do nothing;

comment on table public.platform_settings is
  'Platform-wide switches, read by edge functions and written only by the admin fn. canary_mode = {"enabled":bool}: when enabled, location_tool_access becomes a WHITELIST (no row = denied) instead of the normal default-allow.';
