-- ════════════════════════════════════════════════════════════════════════
-- Admin Portal — Step A: the admin allowlist.
--
-- Platform-level (manages ALL tools). ADDITIVE ONLY — one new table referencing
-- auth.users; touches nothing existing (RB tables, ghl_locations, copywriter).
--
-- `platform_admins` is the login allowlist. It has NO anon/authenticated RLS
-- policies, so with RLS enabled it is readable ONLY by the service role — i.e.
-- only the authenticated `admin` edge function (which first validates the
-- caller's JWT, then checks membership with the service role). The frontend can
-- never read it directly. Security is server-enforced, not URL/secret-based.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.platform_admins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  email      text,
  name       text,
  role       text not null default 'admin',   -- room for 'owner' / 'viewer' later
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
-- No policies on purpose: anon + authenticated get NO access; only the service
-- role (admin edge fn) can read/write. Do not add a permissive policy here.
