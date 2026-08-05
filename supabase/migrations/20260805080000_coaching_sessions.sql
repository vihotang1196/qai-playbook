-- ════════════════════════════════════════════════════════════════════════
-- Coaching Night sessions — homepage content out of the source tree.
--
-- ADDITIVE ONLY. Creates ONE new table. Touches nothing else (no drops, no
-- alters of existing tables).
--
-- WHY NO TOOL PREFIX: Coaching Night is Playbook HOMEPAGE content, shown to
-- every sub-account. It is not part of any tool, so it gets no `oe_` / `hd_` /
-- `rb_` prefix — those namespaces belong to Offline Event / Helpdesk / Review
-- Boost respectively.
--
-- Until now the past-replay list lived in a hardcoded array in
-- src/lib/coaching.ts, so publishing a replay meant a code change + a deploy.
-- This table is the source of truth from here on; the admin portal writes it,
-- the public `coaching` edge fn reads it.
--
-- SHAPE — replay_url is the discriminator, deliberately nullable:
--   replay_url NOT NULL → a PAST session, shown under 「过往录像」 on the homepage
--   replay_url NULL     → a SCHEDULED session with no recording yet
-- Step 1 (this change) only ever writes rows WITH a replay_url. The homepage's
-- 「即将到来」 block is still computed in code (HeroSection's COACHING_ANCHOR
-- fortnight algorithm) and is untouched; step 2 will move it into these
-- null-replay rows without needing another schema change.
--
-- SECURITY: RLS ON with NO policy → service role only, matching every hd_ / oe_
-- table. The frontend never touches this table directly; public reads go
-- through the anon-callable, read-only `coaching` fn and writes go through the
-- requireAdmin-gated `admin` fn.
-- ════════════════════════════════════════════════════════════════════════

-- Shared updated_at trigger fn already exists (Review Boost Phase 1 / Helpdesk
-- Phase 1). Re-assert it idempotently so this migration is self-contained; the
-- body is identical.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.coaching_sessions (
  id           uuid primary key default gen_random_uuid(),
  session_date date not null,
  topic        text not null default '',
  replay_url   text,          -- null = no recording yet (step 2's 「即将到来」)
  cover_url    text,          -- optional thumbnail; the UI falls back to a
                              -- branded placeholder when absent
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Both the public list and the admin list read newest-first.
create index if not exists coaching_sessions_date_idx
  on public.coaching_sessions (session_date desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_coaching_sessions_updated_at') then
    create trigger set_coaching_sessions_updated_at
      before update on public.coaching_sessions
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.coaching_sessions enable row level security;
-- Intentionally NO policy: service role only (same model as hd_* / oe_*).

-- ── Seed: the 4 replays currently hardcoded in src/lib/coaching.ts ───────
-- Verbatim — same dates, same topics, same URLs. The 15 JUN cover is the
-- literal `url` from src/assets/nurture-os-15jun.png.asset.json (a site-relative
-- asset path, not an absolute CDN URL — it resolves against the site origin).
-- Guarded on emptiness so a re-run can never duplicate the seed.
insert into public.coaching_sessions (session_date, topic, replay_url, cover_url)
select * from (values
  ('2026-07-27'::date, '转化', 'https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/6a67600495687dbf221e49dd.mp4', null::text),
  ('2026-07-13'::date, '转化', 'https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/6a55de071097b811959d71f8.mp4', null::text),
  ('2026-06-29'::date, '转化', 'https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/6a4340e63a7f0c5468a4a952.mp4', null::text),
  ('2026-06-15'::date, '转化', 'https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/6a30fc59998928ce1fdb43b7.mp4',
   '/__l5e/assets-v1/d09d5735-c9ae-45c3-9fae-0c1df553671b/nurture-os-15jun.png')
) as seed(session_date, topic, replay_url, cover_url)
where not exists (select 1 from public.coaching_sessions);
