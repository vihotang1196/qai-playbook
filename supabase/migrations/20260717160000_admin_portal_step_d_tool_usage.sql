-- ════════════════════════════════════════════════════════════════════════
-- Admin Portal — Step D: shared cross-tool usage log.
--
-- ADDITIVE ONLY. One new platform-level table (tool-agnostic via tool_key) — the
-- usage meter every tool writes to and the Admin Portal reads for its overview
-- (and the future basis for credits/billing). RLS ON with NO anon/authenticated
-- policy → service role only (tools write via their edge fns; admin reads via the
-- requireAdmin-gated `admin` fn). Never exposed to the customer app.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.tool_usage (
  id          uuid primary key default gen_random_uuid(),
  tool_key    text not null,                 -- review_boost | copywriter | offline_event | whatsapp | …
  location_id text,                          -- the Sub Account (nullable + NO FK → any tool can log freely)
  event_type  text not null,                 -- generation | posted | … (per-tool)
  quantity    integer not null default 1,    -- usually 1; room for credits weighting later
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists tool_usage_tool_idx     on public.tool_usage (tool_key);
create index if not exists tool_usage_location_idx  on public.tool_usage (location_id);
create index if not exists tool_usage_created_idx   on public.tool_usage (created_at desc);
create index if not exists tool_usage_event_idx     on public.tool_usage (event_type);

alter table public.tool_usage enable row level security;
-- No policy on purpose → service role only.

-- ── One-time backfill from existing RB data (owner approved) ────────────────
-- Each rb_generations row = one 'generation' usage event (same timestamp); rows
-- with posted=true also get a 'posted' event. Runs once (migration).
insert into public.tool_usage (tool_key, location_id, event_type, created_at, meta)
select 'review_boost', location_id, 'generation', created_at,
       jsonb_build_object('campaign_id', campaign_id, 'backfill', true)
from public.rb_generations;

insert into public.tool_usage (tool_key, location_id, event_type, created_at, meta)
select 'review_boost', location_id, 'posted', created_at,
       jsonb_build_object('campaign_id', campaign_id, 'backfill', true)
from public.rb_generations
where posted = true;
