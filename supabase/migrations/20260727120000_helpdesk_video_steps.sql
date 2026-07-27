-- ════════════════════════════════════════════════════════════════════════
-- Helpdesk — video-steps cache  (AI video-tutorial upgrade, phase 1)
--
-- ADDITIVE ONLY. One new table, hd_video_steps. Not a single DROP or ALTER of
-- any EXISTING object: nothing belonging to Review Boost (rb_*, ghl_locations),
-- the Admin Portal (platform_admins, location_tool_access, admin_audit_log,
-- tool_usage), Offline Event (oe_*), the copywriter, or the other hd_ tables is
-- touched.
--
-- WHY A SEPARATE TABLE (owner-locked): the extracted steps must NOT live in
-- hd_articles.content — the Notion sync REWRITES that body on every run, which
-- would wipe the cache. Videos are inline `[📹 caption](url)` markers in the
-- body, and one article can hold several videos, so a per-article column can't
-- hold N results either. Keyed by the video itself, the cache survives re-sync.
--
-- WHAT IT IS: a preprocess-once / read-many cache. Each video is read ONCE by a
-- multimodal LLM (WaveSpeed → google/gemini-3-flash-preview, which accepts the
-- bucket's public mp4 URL directly) and its step-by-step instructions are stored
-- here as text. helpdesk-chat later feeds that cheap text to Claude instead of
-- re-reading the video, so answering costs nothing extra. Verified in a phase-0
-- smoke test: real tutorial video → correct 第一步…第六步 steps, ~US$0.02/video.
--
-- SECURITY: RLS ON with NO policy → service-role only, exactly like every other
-- hd_ table. Only edge functions (the preprocessor writing rows, helpdesk-chat
-- reading them) touch it; the frontend never does.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.hd_video_steps (
  id            uuid primary key default gen_random_uuid(),

  -- Which article this video belongs to. Cascade: if the article goes, so does
  -- its cached steps (they describe that article's video).
  article_id    uuid not null references public.hd_articles (id) on delete cascade,

  -- WHICH VIDEO — the dedupe / incremental key. `storage_path` is the object
  -- path inside the helpdesk-media bucket (notion/{blockId}.mp4); it is derived
  -- from the Notion block id, so it is stable across re-syncs. That stability is
  -- what makes "skip videos already processed" work; UNIQUE enforces it.
  storage_path  text not null unique,
  video_url     text not null,                 -- the public URL actually sent to the model

  -- THE PAYLOAD: extracted step-by-step instructions, fed to Claude at answer
  -- time. Empty until a successful read (see status).
  steps_text    text not null default '',

  -- status: pending = queued, not read yet · done = steps_text usable ·
  -- failed  = could not read/extract (chat FALLS BACK to "open the guide and
  --           watch the video" — a failure must never block an answer) ·
  -- skipped = deliberately not processed (e.g. oversized / unsupported).
  status        text not null default 'pending'
                check (status in ('pending', 'done', 'failed', 'skipped')),
  error         text,                          -- short reason when failed/skipped

  duration_sec  integer,                       -- video length, for cost/QA review
  model         text,                          -- e.g. google/gemini-3-flash-preview (traceable if we re-run on a better model)
  token_usage   jsonb,                         -- provider-reported usage/cost for this read
  attempts      integer not null default 0,    -- retry counter, so a poison video can be given up on

  processed_at  timestamptz,                   -- when steps_text was produced
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Fetch every video's steps for one article (the helpdesk-chat read path).
create index if not exists hd_video_steps_article_idx on public.hd_video_steps (article_id);
-- Pull the next batch to process (the preprocessor's resumable queue scan).
create index if not exists hd_video_steps_status_idx  on public.hd_video_steps (status);

-- Reuse the shared updated_at trigger function already defined in phase 1.
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_hd_video_steps_updated_at') then
    create trigger set_hd_video_steps_updated_at
      before update on public.hd_video_steps
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Service-role only (RLS enabled, no policy) — same as every other hd_ table.
alter table public.hd_video_steps enable row level security;
