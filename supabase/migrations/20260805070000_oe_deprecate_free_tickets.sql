-- ════════════════════════════════════════════════════════════════════════
-- Deprecate `free_tickets`, and stop the column defaults from granting an
-- allowance nobody asked for.
--
-- WHY (audited 2026-08-04): `free_tickets` never did anything. Pricing and
-- booking validation read `free_seats` only — `oe/index.ts` selects
-- `free_seats`, derives `freeAllot` from it, and counts consumption from
-- `oe_bookings.free_seats`. `free_tickets` entered no arithmetic anywhere, the
-- customer app never read it (declared in the client type, zero call sites), and
-- its only visible effect was an admin form field describing an allowance that
-- did not exist. An admin who typed "票 = 5" granted nothing.
--
-- NOT DROPPED. 918 rows of history sit in this column and dropping it buys
-- nothing; it is left in place, marked, and no longer written by any code path.
--
-- THE DEFAULTS ARE THE OTHER HALF, and they were the real trap. They still read
-- `free_tickets DEFAULT 1` / `free_seats DEFAULT 2` from the original P1 create
-- table, so any future INSERT that omitted those columns would silently grant
-- TWO free seats — RM 794 at the current ticket price. No code path relied on
-- them today (both writers passed values explicitly), which is exactly why it
-- would have gone unnoticed until someone added a third writer.
--
-- Owner's standing policy, recorded here because these defaults are where it is
-- enforced: a free allowance is granted deliberately, per sub-account, in the
-- admin. It is never inherited by a sub-account for merely existing.
--
-- ORDER OF DEPLOYMENT MATTERS AND IS NOT INTERCHANGEABLE: apply this migration
-- BEFORE deploying the functions that ship with it. `oe`'s auto-register upsert
-- stops passing `free_tickets` and starts relying on the column default set
-- below. Deploy the function first and every row created in the gap inherits the
-- OLD default of 1. Harmless for `free_tickets` specifically (nothing reads it),
-- but the rule generalises: whenever code changes to rely on a database default,
-- the migration goes first.
-- ════════════════════════════════════════════════════════════════════════

comment on column public.oe_subaccount_settings.free_tickets is
  'DEPRECATED 2026-08-05 — never affected pricing, validation or the customer UI. '
  'No code path reads or writes it. Kept for the 918 rows of history; the free '
  'allowance lives entirely in free_seats.';

comment on column public.oe_subaccount_settings.free_seats is
  'The real free allowance, in seats. Consumption is counted from '
  'oe_bookings.free_seats. Default 0 on purpose: an allowance is granted '
  'deliberately per sub-account, never inherited by existing.';

alter table public.oe_subaccount_settings
  alter column free_tickets set default 0,
  alter column free_seats   set default 0;
