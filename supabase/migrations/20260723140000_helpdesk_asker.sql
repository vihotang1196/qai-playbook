-- Helpdesk per-staff attribution (Need 2) — record WHO asked each conversation.
--
-- The shared help center identifies the sub-account by location_id only; there's
-- no per-person identity today. These columns hold the GHL staff who asked,
-- captured from the Custom Menu Link merge fields (staff_email / staff_name) at
-- ask time and written when a conversation is CREATED. Trust-the-URL (WEAK) —
-- used for attribution / admin filtering only, never auth.
--
-- Additive + idempotent. Existing conversations keep NULL (shown as "—" in the
-- admin, i.e. pre-attribution); new conversations with no email → "匿名访客".

alter table public.hd_conversations add column if not exists asker_email text;
alter table public.hd_conversations add column if not exists asker_name  text;
