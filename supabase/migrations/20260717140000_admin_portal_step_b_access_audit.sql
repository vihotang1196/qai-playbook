-- ════════════════════════════════════════════════════════════════════════
-- Admin Portal — Step B: per-tool access matrix + audit log.
--
-- ADDITIVE ONLY. Two new platform-level tables (tool-agnostic via tool_key);
-- touches nothing existing. Both have RLS ON with NO anon/authenticated policy,
-- so only the service role (the requireAdmin-gated `admin` edge fn) can read or
-- write them. Never expose to the customer app.
-- ════════════════════════════════════════════════════════════════════════

-- Per (sub-account, tool) access. DEFAULT-ALLOW: absence of a row = enabled.
-- A row exists only once an admin has explicitly set it (on or off).
create table if not exists public.location_tool_access (
  id          uuid primary key default gen_random_uuid(),
  location_id text not null references public.ghl_locations (location_id) on delete cascade,
  tool_key    text not null,                    -- review_boost | copywriter | (future)
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,                             -- the admin (auth.users id) who last changed it
  unique (location_id, tool_key)
);
create index if not exists location_tool_access_location_idx on public.location_tool_access (location_id);
alter table public.location_tool_access enable row level security;
-- No policy on purpose → service role only.

-- Who changed what, when (per the owner's audit requirement).
create table if not exists public.admin_audit_log (
  id                 uuid primary key default gen_random_uuid(),
  admin_user_id      uuid,
  admin_email        text,
  action             text not null,             -- e.g. set_tool_access | sync_locations
  target_location_id text,
  tool_key           text,
  detail             jsonb,                     -- e.g. {"from": true, "to": false}
  created_at         timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
alter table public.admin_audit_log enable row level security;
-- No policy on purpose → service role only.
