-- ════════════════════════════════════════════════════════════════════════
-- Review Boost — Phase 1 schema
--
-- ADDITIVE ONLY. Every statement is CREATE ... IF NOT EXISTS / CREATE OR
-- REPLACE / guarded DO-blocks. There is NOT a single DROP or ALTER of an
-- existing object anywhere in this file — nothing the copywriter uses can be
-- touched. (The copywriter is stateless: it has no tables/DB functions in this
-- project, so there is nothing to collide with either.)
--
-- Table layout:
--   ghl_locations   SHARED identity table (tool-neutral, NO prefix). One row
--                   per GoHighLevel sub-account, synced from GHL. All tools
--                   (copywriter, Review Boost, future Offline Event) reuse it.
--   rb_campaigns    Review Boost: one row per store's QR review setup.
--                   ← the one-to-many lives here: 1 location → many campaigns.
--   rb_qr_codes     Review Boost: the scannable short-code for a campaign.
--   rb_generations  Review Boost: one row per AI review generated (per scan).
--
-- rb_ = Review-Boost-owned. All rb_ tables reference ghl_locations.location_id.
-- ════════════════════════════════════════════════════════════════════════


-- ── Shared helper: auto-touch updated_at on UPDATE ──────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ════════════════════════════════════════════════════════════════════════
-- SHARED  ·  ghl_locations   (GHL sub-accounts, synced from GoHighLevel)
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.ghl_locations (
  id            uuid primary key default gen_random_uuid(),
  location_id   text not null unique,           -- GHL location id — the join key every tool uses
  business_name text,
  logo_url      text,
  niche         text,
  email         text,
  phone         text,
  is_enabled    boolean not null default true,
  user_id       uuid references auth.users (id),-- operator/owner (wired up in Phase 3; nullable for now)
  synced_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_ghl_locations_updated_at') then
    create trigger set_ghl_locations_updated_at
      before update on public.ghl_locations
      for each row execute function public.set_updated_at();
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════════════
-- REVIEW BOOST  ·  rb_campaigns   (one per store's QR review setup)
--   1 ghl_locations  ──<  many rb_campaigns
--   Each campaign carries THIS store's own info + review link + (via its rows
--   in rb_qr_codes / rb_generations) its own independent stats.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.rb_campaigns (
  id                 uuid primary key default gen_random_uuid(),
  location_id        text not null references public.ghl_locations (location_id) on delete cascade,
  name               text not null,                     -- e.g. "Glow Beauty — Bangsar"
  platform           text not null default 'google',    -- google | facebook | shopee | custom
  review_url         text,                              -- THIS store's review destination link
  business_name      text,                              -- store info fed to the AI
  industry           text,
  category           text,
  signature_features text[] not null default '{}',      -- signature products / selling points
  logo_url           text,                              -- optional QR-centre logo / branding
  thank_you_mode     text not null default 'message',   -- message | url
  thank_you_message  text,
  redirect_url       text,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists rb_campaigns_location_id_idx on public.rb_campaigns (location_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_rb_campaigns_updated_at') then
    create trigger set_rb_campaigns_updated_at
      before update on public.rb_campaigns
      for each row execute function public.set_updated_at();
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════════════
-- REVIEW BOOST  ·  rb_qr_codes   (the scannable code for a campaign)
--   Held separately from the campaign so scan_count lives here and a campaign
--   could be re-issued a fresh code later. short_code is what /scan/:code uses.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.rb_qr_codes (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.rb_campaigns (id) on delete cascade,
  location_id text not null references public.ghl_locations (location_id) on delete cascade,
  short_code  text not null unique,                 -- the code embedded in the QR ( /scan/<short_code> )
  scan_count  integer not null default 0,           -- per-store stat #1: scans
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists rb_qr_codes_campaign_id_idx on public.rb_qr_codes (campaign_id);
create index if not exists rb_qr_codes_location_id_idx  on public.rb_qr_codes (location_id);


-- ════════════════════════════════════════════════════════════════════════
-- REVIEW BOOST  ·  rb_generations   (one row per AI review generated / scan)
--   Per-store stat #2 (count of rows = reviews generated) and #3 (share with
--   posted = true = posted-rate). Filter by campaign_id → independent per store.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.rb_generations (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.rb_campaigns (id) on delete cascade,
  qr_code_id  uuid references public.rb_qr_codes (id) on delete set null,
  location_id text not null references public.ghl_locations (location_id) on delete cascade,
  review_text text not null,
  persona     text,
  rating      integer not null default 5,
  posted      boolean not null default false,        -- customer confirmed they posted it
  created_at  timestamptz not null default now()
);
create index if not exists rb_generations_campaign_id_idx on public.rb_generations (campaign_id);
create index if not exists rb_generations_location_id_idx  on public.rb_generations (location_id);


-- ── RPC: bump a QR's scan_count (called when a customer scans) ──────────────
-- SECURITY DEFINER so the public scan flow can increment without direct table
-- write access. Runs as the function owner, only touches rb_qr_codes.
create or replace function public.increment_scan_count(qr_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.rb_qr_codes set scan_count = scan_count + 1 where id = qr_id;
$$;
grant execute on function public.increment_scan_count(uuid) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- Row Level Security
--   Phase 1 keeps it SIMPLE (per your "simplest working login"): any signed-in
--   user may read/manage; anonymous visitors get NO direct table access.
--   The public /scan flow never touches these tables directly — it goes through
--   the edge function using the service-role key, which bypasses RLS. We tighten
--   to per-location ownership (via ghl_locations.user_id) in Phase 3.
-- ════════════════════════════════════════════════════════════════════════
alter table public.ghl_locations  enable row level security;
alter table public.rb_campaigns   enable row level security;
alter table public.rb_qr_codes    enable row level security;
alter table public.rb_generations enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ghl_locations' and policyname = 'authenticated manage ghl_locations') then
    create policy "authenticated manage ghl_locations" on public.ghl_locations
      for all to authenticated using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rb_campaigns' and policyname = 'authenticated manage rb_campaigns') then
    create policy "authenticated manage rb_campaigns" on public.rb_campaigns
      for all to authenticated using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rb_qr_codes' and policyname = 'authenticated manage rb_qr_codes') then
    create policy "authenticated manage rb_qr_codes" on public.rb_qr_codes
      for all to authenticated using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rb_generations' and policyname = 'authenticated manage rb_generations') then
    create policy "authenticated manage rb_generations" on public.rb_generations
      for all to authenticated using (true) with check (true);
  end if;
end $$;
