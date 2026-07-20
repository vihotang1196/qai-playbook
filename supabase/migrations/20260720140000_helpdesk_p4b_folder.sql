-- ════════════════════════════════════════════════════════════════════════
-- Helpdesk — P4b folder resolution: stamp the resolved folder on queue rows.
--
-- ADDITIVE ONLY (Helpdesk-owned table). The sync now resolves each database's
-- folder ONCE at plan time (folder = the section heading of its layout, e.g.
-- "Automation" / "Payments") and stores it on the queue so batch processing
-- doesn't re-resolve per call.
-- ════════════════════════════════════════════════════════════════════════

alter table public.hd_sync_queue
  add column if not exists folder_id uuid;
