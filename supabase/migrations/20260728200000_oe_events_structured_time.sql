-- ════════════════════════════════════════════════════════════════════════
-- Offline Event — structured start/end time on oe_events (batch 1).
--
-- WHY: `time_slot` is free text ("10:00 AM - 6:00 PM"), so times can't be
-- sorted, compared or validated, and nothing stops it contradicting the dates.
-- These two columns make the time machine-readable. `time_slot` is KEPT and
-- untouched — later batches generate it FROM these columns and fall back to the
-- stored text whenever both are null, so old rows keep rendering exactly as now.
--
-- TIMEZONE: `time` WITHOUT time zone, on purpose. Everything in this product is
-- Malaysia local time (UTC+8); storing naive local times means no conversion
-- anywhere and no chance of an off-by-8-hours bug. Do NOT switch to timetz.
--
-- ADDITIVE ONLY: nothing is dropped, no existing column is altered, and
-- `display_label` is deliberately left alone (its "is it a title or a date?"
-- ambiguity is batch 3's problem, not this migration's).
--
-- BACKFILL: hard-coded by id for the ONE row that exists, rather than a generic
-- parser. A regex would be dead weight against a single known value and a trap
-- for whatever format someone types next; anything unparseable must stay NULL,
-- and with one row there is nothing else to parse.
--
-- ROLLBACK (safe, lossless — see the note at the bottom):
--   alter table public.oe_events drop column start_time, drop column end_time;
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) The columns. Nullable: a null pair means "no structured time yet",
--       which is exactly the signal the display fallback keys off. ──────────
alter table public.oe_events
  add column if not exists start_time time null,
  add column if not exists end_time   time null;

comment on column public.oe_events.start_time is
  'Event start, Malaysia local time (UTC+8), no timezone stored. NULL = fall back to the free-text time_slot.';
comment on column public.oe_events.end_time is
  'Event end, Malaysia local time (UTC+8), no timezone stored. NULL = fall back to the free-text time_slot.';

-- ── 2) Backfill the single existing row, matched by id ───────────────────
--   id         74753c55-65db-4ef5-a511-89838f6ce0ca
--   label      盈利营销实战班
--   time_slot  '10:00 AM - 6:00 PM'  →  start 10:00:00, end 18:00:00
-- The time_slot guard makes this a no-op if that text ever changed before this
-- migration ran, so it can never write a time that disagrees with the text.
update public.oe_events
   set start_time = time '10:00:00',
       end_time   = time '18:00:00',
       updated_at = now()
 where id = '74753c55-65db-4ef5-a511-89838f6ce0ca'
   and time_slot = '10:00 AM - 6:00 PM'
   and start_time is null
   and end_time is null;

-- ── 3) Verification (run by hand; `db push` shows no query output) ────────
-- select id, display_label, time_slot, start_time, end_time
--   from public.oe_events
--  order by start_date;
--
-- Expected for the row above:
--   time_slot = '10:00 AM - 6:00 PM' | start_time = 10:00:00 | end_time = 18:00:00
-- Any row this migration could not fill shows start_time/end_time as NULL —
-- those are for manual handling, never guessed.

-- ── Rollback notes ───────────────────────────────────────────────────────
-- Dropping both columns restores the exact current state: `time_slot` was never
-- modified, so no information is lost — the dropped values were only ever
-- derived from it and can be regenerated.
-- ⚠️ Only safe BEFORE batch 2/3 ship. Once the frontend reads start_time,
-- dropping the columns breaks those pages, so a rollback then has to revert the
-- code together with the schema.
