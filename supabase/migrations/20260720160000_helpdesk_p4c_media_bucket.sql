-- ════════════════════════════════════════════════════════════════════════
-- Helpdesk — P4c: public Storage bucket for Notion media.
--
-- ADDITIVE ONLY. Notion serves images/videos/files from EXPIRING S3 URLs, so
-- the sync downloads them and re-hosts them here, then rewrites the article
-- content to point at these permanent URLs. Public bucket = the widget can load
-- the media without auth; writes happen only via the service role inside the
-- helpdesk-admin edge fn (service role bypasses Storage RLS).
-- ════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('helpdesk-media', 'helpdesk-media', true)
on conflict (id) do nothing;
