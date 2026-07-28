-- ════════════════════════════════════════════════════════════════════════
-- Offline Event — a real title field on oe_events (batch 1.5).
--
-- WHY: `display_label` was doing two incompatible jobs. Its original purpose
-- was a human date string ("25 - 26 July 2026 (Sat - Sun)"), but the admin form
-- reads as a name field, so the one real event holds 「盈利营销实战班」 there —
-- and the customer page renders that value next to a calendar icon, i.e. shows
-- the event's NAME as its date. Splitting the jobs is the fix: `title_zh` /
-- `title_en` hold the name, and dates are always generated from
-- start_date/end_date with NO override entry — a re-introduced optional
-- override is precisely the trap that produced this.
--
-- ADDITIVE ONLY: nothing dropped, no existing column altered (`display_label`
-- keeps its NOT NULL), no frontend touched in this migration.
--
-- `display_label` becomes a SHADOW of title_zh, written in exactly one place
-- (buildEventRow, batch 2) so the two can never diverge. Divergence would
-- matter: event_label and the QR payload are SNAPSHOTS taken from it at booking
-- time, so a split value would make printed tickets unpredictable.
--
-- ROLLBACK (lossless — see the note at the bottom):
--   alter table public.oe_events drop column title_zh, drop column title_en;
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) The columns. Nullable, matching theme_*/notice_*. ─────────────────
alter table public.oe_events
  add column if not exists title_zh text null,
  add column if not exists title_en text null;

comment on column public.oe_events.title_zh is
  'Event name (Chinese). The authoritative name — display_label is only a shadow copy of this.';
comment on column public.oe_events.title_en is
  'Event name (English). NULL is normal: the UI falls back to title_zh rather than rendering a blank name.';

comment on column public.oe_events.display_label is
  'DEPRECATED — superseded by title_zh. Kept only for compatibility (still NOT NULL, and copied into oe_bookings.event_label / qr_payload snapshots). Written ONLY as a shadow of title_zh by buildEventRow; never edit it directly and never expose it in a form.';

-- ── 2) Move the one existing name into title_zh ──────────────────────────
--   id     74753c55-65db-4ef5-a511-89838f6ce0ca
--   value  '盈利营销实战班'  (currently living in display_label)
-- Guarded exactly like batch 1: exact id, exact expected source value, and
-- title_zh still empty — so if anything changed between review and execution
-- this no-ops instead of writing something unintended. title_en stays NULL on
-- purpose; the English name is the owner's to write, never machine-translated.
update public.oe_events
   set title_zh   = display_label,
       updated_at = now()
 where id = '74753c55-65db-4ef5-a511-89838f6ce0ca'
   and display_label = '盈利营销实战班'
   and title_zh is null;

-- ── 3) Verification (run by hand; `db push` prints no query output) ───────
-- select id, display_label, title_zh, title_en, start_date, end_date,
--        start_time, end_time
--   from public.oe_events
--  order by start_date;
--
-- Expected: display_label '盈利营销实战班' | title_zh '盈利营销实战班'
--           | title_en NULL
-- A row where title_zh came back NULL was not matched by the guard above and
-- needs manual attention — nothing is ever guessed.

-- ── Rollback notes ───────────────────────────────────────────────────────
-- Dropping both columns restores the current state exactly: display_label was
-- never modified, so the name is still there and nothing is lost.
-- ⚠️ Safe only BEFORE batch 2/3 ship. Once the admin form writes title_zh and
-- the customer page reads it, dropping the columns loses names entered after
-- this migration, and the rollback has to revert the code as well.
