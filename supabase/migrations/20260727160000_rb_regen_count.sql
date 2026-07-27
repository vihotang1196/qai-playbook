-- ════════════════════════════════════════════════════════════════════════
-- Pre-launch rate limiting — step 4: close the Review Boost "regenerate" hole.
--
-- ADDITIVE ONLY: one new NOT-NULL-with-default column on rb_generations. No
-- column/index/constraint is dropped or altered; existing rows simply get 0.
-- Nothing outside Review Boost is touched.
--
-- THE HOLE (recorded as a pre-launch TODO in PROGRESS-REVIEW-BOOST.md): the
-- public scan flow's abuse caps count rb_generations ROWS created in a window.
-- "Regenerate" deliberately UPDATES the existing row in place (so the owner's
-- scan_count stays an accurate count of real scans) — which means it creates no
-- row and is therefore INVISIBLE to those caps. A script pointed at one recent
-- generationId could re-roll it indefinitely, burning a Claude call each time,
-- bounded only by the 60-minute row-age window.
--
-- THE FIX: count regenerations on the row itself and cap them server-side. The
-- scan page already limits itself to 3 regenerations per page; the server cap
-- sits just above that, so real customers never notice while a script is stopped
-- after a handful of calls per row.
-- ════════════════════════════════════════════════════════════════════════

alter table public.rb_generations
  add column if not exists regen_count smallint not null default 0;

comment on column public.rb_generations.regen_count is
  'Server-side count of in-place regenerations for this scan. Capped in the generate-review edge fn so a scripted caller cannot re-roll one row indefinitely (regeneration updates the row, so it is invisible to the row-count based per-QR caps).';
