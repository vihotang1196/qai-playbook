-- ════════════════════════════════════════════════════════════════════════
-- Launch prep (2026-07-28, owner-approved): ZERO every sub-account's
-- Offline Event free allowance, then lower the global default to 1/1.
--
-- WHY the explicit rows: `oe_subaccount_settings` is sparse — a sub-account
-- with no row falls back to the GLOBAL default the first time it opens the
-- tool (`oe` fn resolveContext auto-registers it). Only 6 of the 911 known
-- sub-accounts had a row, so clearing existing rows alone would still hand
-- the other ~909 the old 1-ticket/2-seat default on their first visit.
-- We therefore materialise an explicit 0/0 row for EVERY known sub-account.
--
-- WHY one transaction: the whole file runs atomically, so there is no window
-- in which the allowance rows are written but the global default is still the
-- old 1/2 (or vice versa). Nobody can slip through mid-flight.
--
-- Effect on a FUTURE sub-account (synced from GHL after this runs): it has no
-- row, so it picks up the NEW global default = 1 ticket / 1 seat.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) Every known sub-account gets an explicit 0 / 0 row ───────────────
insert into public.oe_subaccount_settings (location_id, free_tickets, free_seats, updated_at)
select l.location_id, 0, 0, now()
from public.ghl_locations l
on conflict (location_id) do update
  set free_tickets = 0,
      free_seats   = 0,
      updated_at   = now();

-- ── 2) Any leftover override row that is NOT a GHL sub-account ──────────
-- (old test location ids) — zero them too, so nothing anywhere still holds
-- a free allowance.
update public.oe_subaccount_settings
   set free_tickets = 0,
       free_seats   = 0,
       updated_at   = now()
 where free_tickets <> 0
    or free_seats   <> 0;

-- ── 3) ONLY NOW lower the global default (1 ticket / 1 seat) ────────────
-- Applies solely to sub-accounts that appear AFTER this migration.
insert into public.oe_settings (key, value, updated_at)
values ('default_free_tickets', '1', now()),
       ('default_free_seats',   '1', now())
on conflict (key) do update
  set value      = excluded.value,
      updated_at = now();
