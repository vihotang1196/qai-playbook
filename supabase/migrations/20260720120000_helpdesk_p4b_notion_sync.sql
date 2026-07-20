-- ════════════════════════════════════════════════════════════════════════
-- Helpdesk — P4b: Notion sync scaffolding (batched, resumable, incremental)
--
-- ADDITIVE ONLY. Touches ONLY Helpdesk-owned objects:
--   • NEW hd_sync_queue — the per-database work-list that makes a large sync
--     (the owner has ~1200 articles across many databases) batchable + resumable:
--     one row per Notion page with a status. Progress + resume survive reloads
--     because the queue lives in the DB, not the browser.
--   • hd_articles gains notion_last_edited (Notion's last_edited_time) so re-syncs
--     can SKIP unchanged pages instead of re-importing everything (the old
--     export re-imported every page every run — the main scale problem).
--
-- No other tool's tables are touched. hd_sync_queue is RLS-locked (service-role
-- only) like every other hd_ table; all access is via the requireAdmin-gated
-- helpdesk-admin fn.
-- ════════════════════════════════════════════════════════════════════════

-- Incremental marker on articles (additive column on our OWN table).
alter table public.hd_articles
  add column if not exists notion_last_edited timestamptz;

-- Per-database sync work-list.
create table if not exists public.hd_sync_queue (
  id               uuid primary key default gen_random_uuid(),
  database_id      text not null,                 -- the Notion database being synced
  page_id          text not null,                 -- a Notion page (article) in it
  page_last_edited timestamptz,                   -- Notion last_edited_time at plan time
  status           text not null default 'pending', -- pending | done | failed | skipped
  error            text,                          -- failure reason (status='failed')
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (database_id, page_id)
);
create index if not exists hd_sync_queue_db_status_idx on public.hd_sync_queue (database_id, status);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_hd_sync_queue_updated_at') then
    create trigger set_hd_sync_queue_updated_at
      before update on public.hd_sync_queue
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.hd_sync_queue enable row level security;
-- No policy on purpose → service role only.
