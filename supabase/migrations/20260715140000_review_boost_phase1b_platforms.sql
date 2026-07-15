-- ════════════════════════════════════════════════════════════════════════
-- Review Boost — Phase 1b: platform-config layer + campaign adjustment
--
-- Corrective migration for Option B (decided with the owner): the review LINK
-- lives in a separate platform-config layer; a campaign carries its own
-- business info and just REFERENCES a platform config (for the link).
--
-- Scope: ADDITIVE + a change to our OWN, EMPTY rb_campaigns table only. It does
-- NOT touch anything the copywriter uses, and does NOT edit the original Phase 1
-- migration file. rb_campaigns has no rows yet, so dropping review_url from it
-- loses no data.
-- ════════════════════════════════════════════════════════════════════════


-- ── 1) Platform-config layer (LINKS ONLY) ──────────────────────────────────
-- One row per (sub-account, platform): the sub-account enables a platform on
-- the Platforms page and pastes its review link. No business info here — that
-- lives on the campaign (Option B).
create table if not exists public.rb_platform_integrations (
  id          uuid primary key default gen_random_uuid(),
  location_id text not null references public.ghl_locations (location_id) on delete cascade,
  platform    text not null,                    -- google_maps | facebook | shopee | custom
  review_url  text,                             -- where customers go to post the review
  is_enabled  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (location_id, platform)                -- one config per platform per sub-account
);
create index if not exists rb_platform_integrations_location_id_idx
  on public.rb_platform_integrations (location_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_rb_platform_integrations_updated_at') then
    create trigger set_rb_platform_integrations_updated_at
      before update on public.rb_platform_integrations
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- RLS — same posture as the other rb_ tables: signed-in users manage; the
-- public /scan flow reads via the edge function's service role (bypasses RLS).
alter table public.rb_platform_integrations enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rb_platform_integrations'
      and policyname = 'authenticated manage rb_platform_integrations'
  ) then
    create policy "authenticated manage rb_platform_integrations" on public.rb_platform_integrations
      for all to authenticated using (true) with check (true);
  end if;
end $$;


-- ── 2) rb_campaigns adjustment (Option B) ──────────────────────────────────
-- The link moves to the platform layer, so:
--   • ADD integration_id → which platform config (→ which link) this campaign
--     posts to. Nullable + ON DELETE SET NULL so removing a platform config
--     doesn't delete campaigns (they just need re-pointing).
--   • DROP review_url (now on rb_platform_integrations). rb_campaigns is empty,
--     so no data is lost.
-- Business info (business_name / industry / category / signature_features),
-- name, logo_url, platform, thank_you_* all STAY on the campaign.
alter table public.rb_campaigns
  add column if not exists integration_id uuid
  references public.rb_platform_integrations (id) on delete set null;

alter table public.rb_campaigns
  drop column if exists review_url;

create index if not exists rb_campaigns_integration_id_idx
  on public.rb_campaigns (integration_id);
