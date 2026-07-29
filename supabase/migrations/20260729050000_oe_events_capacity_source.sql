-- ════════════════════════════════════════════════════════════════════════
-- Offline Event — every event must have a source of truth for "how many
-- people fit" (batch 6, commit 4).
--
-- TWO paths, each with its own source. Nothing else is allowed to go live:
--   seat_selection_enabled = true  → floor_plan_id required; the number is the
--                                    plan's physical_seats (enabled seats)
--   seat_selection_enabled = false → capacity required; it IS the limit
--
-- WHY THIS MATTERS MORE THAN IT LOOKS. The gate in oe_claim_seats is:
--     select coalesce(e.capacity, fp.physical_seats) into v_cap
--       from oe_events e LEFT JOIN oe_floor_plans fp on fp.id = e.floor_plan_id;
--     if v_cap is not null and v_cap > 0 then ... end if;
-- so BOTH `NULL` (no plan and no capacity) and `0` mean "run no capacity check
-- at all" — silently. And in the no-seat-selection path the usual backstop does
-- not exist either: seat labels are synthesised per booking
-- (`#BK-XXXX-YYYY-1`, …), so UNIQUE(event_id, seat_label) can never collide and
-- capacity is the ONLY thing standing between us and selling unlimited tickets.
--
-- SCOPE: only `live`. `display` and `off` are refused by computeBookingPlan
-- ("event_not_bookable"), so they cannot oversell anything, and forbidding
-- half-filled drafts would push people to work around the tool — which is worse.
-- The constraint bites the moment someone flips an incomplete event to live.
--
-- LAYERING: this CHECK is the BACKSTOP, for direct API calls and hand-written
-- SQL. The normal path is guarded earlier, in the saveEvent handler, which
-- returns capacity_source_missing_floorplan / capacity_source_missing_limit so
-- the admin sees a sentence instead of "violates check constraint".
-- ════════════════════════════════════════════════════════════════════════

-- ── 0. The assumption this whole file rests on ────────────────────────────
-- A CHECK constraint rejects only when it evaluates to FALSE. NULL (unknown)
-- PASSES. So if seat_selection_enabled were nullable, a row with
-- status='live', seat_selection_enabled=NULL would evaluate to
--   FALSE or NULL or NULL = NULL  → allowed through
-- and that is exactly the silent hole this file exists to close. Both columns
-- are NOT NULL today; assert it rather than trust it, because a later ALTER
-- would disarm the constraint below without touching this file.
do $$
declare
  v_nullable text;
begin
  select string_agg(column_name, ', ')
    into v_nullable
  from information_schema.columns
  where table_schema = 'public'
    and table_name  = 'oe_events'
    and column_name in ('status', 'seat_selection_enabled')
    and is_nullable = 'YES';
  if v_nullable is not null then
    raise exception 'oe_events.% is nullable; the capacity-source CHECK below would PASS on NULL instead of rejecting. Restore NOT NULL, or rewrite the constraint to treat NULL as unqualified.', v_nullable;
  end if;
end $$;

-- ── 1. Hand seat-selection events over to their floor plan ────────────────
-- Only events that HAVE a plan and use seat selection: for those, the hand-typed
-- number is a second, competing answer (60 vs the plan's 91) and the plan is the
-- authoritative one — how many people fit depends on how the tables are laid out.
-- Events without a plan keep their capacity: it is their only limit. All three
-- conditions are load-bearing; dropping any one clears a number that is somebody's
-- only defence.
update public.oe_events
   set capacity = null,
       updated_at = now()
 where capacity is not null
   and floor_plan_id is not null
   and seat_selection_enabled = true;

-- ── 2. 0 must be impossible ───────────────────────────────────────────────
-- `capacity = 0` does not mean "no seats", it means "no capacity check" (the
-- gate tests v_cap > 0). Typing 0 — or anything Number() can't parse, which the
-- old buildEventRow coerced to 0 — would silently disable overselling protection.
do $$
declare
  v_bad text;
begin
  select string_agg(display_label || ' (' || id::text || ')', ', ')
    into v_bad
  from public.oe_events
  where capacity is not null and capacity <= 0;
  if v_bad is not null then
    raise exception 'These events have capacity <= 0, which switches the capacity check OFF. Set a real limit or clear it to NULL, then re-run: %', v_bad;
  end if;
end $$;

alter table public.oe_events
  drop constraint if exists oe_events_capacity_positive;
alter table public.oe_events
  add constraint oe_events_capacity_positive
  check (capacity is null or capacity > 0);

-- ── 3. A live event must have a source of numbers ─────────────────────────
-- Name the offenders before locking the table: a bare constraint violation tells
-- you something is wrong but not which event.
do $$
declare
  v_bad text;
begin
  select string_agg(display_label || ' (' || id::text || ')', ', ')
    into v_bad
  from public.oe_events
  where status = 'live'
    and not (
      (seat_selection_enabled = true  and floor_plan_id is not null) or
      (seat_selection_enabled = false and capacity is not null)
    );
  if v_bad is not null then
    raise exception 'These LIVE events have no capacity source — give each one a floor plan (seat selection on) or a capacity (seat selection off), then re-run: %', v_bad;
  end if;
end $$;

alter table public.oe_events
  drop constraint if exists oe_events_capacity_source;
alter table public.oe_events
  add constraint oe_events_capacity_source
  check (
    status <> 'live'
    or (seat_selection_enabled = true  and floor_plan_id is not null)
    or (seat_selection_enabled = false and capacity is not null)
  );

-- ── 4. capacity's job, stated ─────────────────────────────────────────────
-- NOT marked deprecated on purpose. For a no-seat-selection event this column is
-- the ONLY limit on how many tickets can be sold, so "deprecated" would invite
-- someone to drop it and quietly enable unlimited sales.
comment on column public.oe_events.capacity is
  'How many people fit, for events WITHOUT seat selection — for those it is the '
  'only limit that exists (synthesised seat labels never collide, so seat '
  'uniqueness protects nothing there). Events WITH seat selection leave this NULL '
  'and take the number from oe_floor_plans.physical_seats via '
  'coalesce(e.capacity, fp.physical_seats) in oe_claim_seats. NOT deprecated, and '
  'not safe to drop. 0 is forbidden by oe_events_capacity_positive because the '
  'gate tests v_cap > 0, i.e. 0 would silently switch the check off.';
