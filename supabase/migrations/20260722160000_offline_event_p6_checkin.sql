-- ════════════════════════════════════════════════════════════════════════
-- Offline Event — P6 (admin QR check-in): record WHEN each booking was checked
-- in for day 1 / day 2. Purely ADDITIVE — two nullable timestamp columns on
-- oe_bookings. The attendance state itself (day1_status / day2_status, values
-- pending | attended | not_attending) already exists from the P1 migration;
-- this only adds the timestamps so the admin board can show "已在 14:32 签到"
-- and keep a light audit trail. Idempotent (ADD COLUMN IF NOT EXISTS) so a
-- re-run is a no-op. Touches no other tool's tables.
-- ════════════════════════════════════════════════════════════════════════
alter table public.oe_bookings
  add column if not exists day1_checked_in_at timestamptz,
  add column if not exists day2_checked_in_at timestamptz;
