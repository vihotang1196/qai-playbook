-- ════════════════════════════════════════════════════════════════════════
-- Offline Event — P7a-2 admin seat operations (change-seat / change-date).
--
-- Two atomic RPCs, siblings of the P4 `oe_claim_seats` (which only INSERTs).
-- These swap a booking's seats — release the OLD, claim the NEW — inside ONE
-- transaction, so a collision on the new seats rolls the whole thing back and
-- the booking KEEPS its old seats (never left seat-less, never double-booked).
--
-- Capacity is checked BEFORE any delete (so an over-capacity request changes
-- nothing), and the UNIQUE(event_id, seat_label) constraint still guards against
-- two parties grabbing the same seat concurrently (the loser gets
-- unique_violation → the exception handler rolls back → returns false).
--
-- Purely additive: new functions only. Does NOT touch `oe_claim_seats`.
-- ════════════════════════════════════════════════════════════════════════

-- ── Change-seat: swap a booking's seats WITHIN the same event ────────────
create or replace function public.oe_reassign_seats(
  p_event_id   uuid,
  p_booking_id uuid,
  p_new_seats  text[]
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap   integer;
  v_taken integer;
  v_own   integer;
  v_want  integer := coalesce(array_length(p_new_seats, 1), 0);
begin
  if v_want = 0 then
    return false;
  end if;

  -- Capacity check FIRST (before any delete). Count on the event excluding this
  -- booking's own current seats, since those are being replaced.
  select coalesce(e.capacity, fp.physical_seats)
    into v_cap
  from public.oe_events e
  left join public.oe_floor_plans fp on fp.id = e.floor_plan_id
  where e.id = p_event_id;

  if v_cap is not null and v_cap > 0 then
    select count(*) into v_taken
    from public.oe_booked_seats where event_id = p_event_id;
    select count(*) into v_own
    from public.oe_booked_seats where event_id = p_event_id and booking_id = p_booking_id;
    if (v_taken - v_own + v_want) > v_cap then
      return false;                                   -- nothing changed yet
    end if;
  end if;

  -- Atomic swap. A duplicate (event_id, seat_label) raises unique_violation,
  -- which the handler catches → the whole block (incl. the delete) rolls back.
  delete from public.oe_booked_seats
   where booking_id = p_booking_id and event_id = p_event_id;
  insert into public.oe_booked_seats (event_id, seat_label, booking_id)
  select p_event_id, s, p_booking_id
  from unnest(p_new_seats) as s;

  return true;
exception
  when unique_violation then
    return false;
end;
$$;

-- ── Change-date: move a booking's seats from one event to another ────────
create or replace function public.oe_move_booking_seats(
  p_old_event_id uuid,
  p_new_event_id uuid,
  p_booking_id   uuid,
  p_new_seats    text[]
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap   integer;
  v_taken integer;
  v_want  integer := coalesce(array_length(p_new_seats, 1), 0);
begin
  if v_want = 0 then
    return false;
  end if;

  -- Capacity check on the NEW event (this booking holds no seats there yet).
  select coalesce(e.capacity, fp.physical_seats)
    into v_cap
  from public.oe_events e
  left join public.oe_floor_plans fp on fp.id = e.floor_plan_id
  where e.id = p_new_event_id;

  if v_cap is not null and v_cap > 0 then
    select count(*) into v_taken
    from public.oe_booked_seats where event_id = p_new_event_id;
    if (v_taken + v_want) > v_cap then
      return false;
    end if;
  end if;

  -- Release on the OLD event, claim on the NEW event — one transaction.
  delete from public.oe_booked_seats
   where booking_id = p_booking_id and event_id = p_old_event_id;
  insert into public.oe_booked_seats (event_id, seat_label, booking_id)
  select p_new_event_id, s, p_booking_id
  from unnest(p_new_seats) as s;

  return true;
exception
  when unique_violation then
    return false;
end;
$$;
