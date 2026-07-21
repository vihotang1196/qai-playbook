-- ════════════════════════════════════════════════════════════════════════
-- Offline Event — Phase 1: schema + seed.
--
-- ADDITIVE ONLY. Creates the `oe_` tables for the 5th migrated tool (line-up
-- booking / seat selection / payment / e-ticket / check-in). Touches NOTHING
-- belonging to other tools (rb_*, hd_* isn't on this branch, ghl_locations,
-- platform_admins, location_tool_access, admin_audit_log, tool_usage).
--
-- Security model (owner decision 9): every oe_ table has RLS ON with NO policy
-- → service role only. The frontend NEVER touches these tables directly; all
-- reads/writes go through the `oe` (customer, location-scoped) and
-- `offline-event-admin` (requireAdmin) edge functions. This closes the old
-- Lovable app's privacy hole (it read the whole bookings table with the anon key).
--
-- NOT ported from the old app:
--   • admin_users            → use the shared platform_admins allowlist.
--   • email_* / suppressed_* / unsubscribe → no email for now (owner decision 1;
--     the web page shows a QR e-ticket instead).
--   • app_settings capacity_limit:<label> keys → capacity now lives on oe_events.
--
-- KEY DESIGN — atomic seat locking (owner decision: "more robust than the old
-- app"). The old try_book_seats only checked the aggregate head-count per date,
-- so two customers could grab the SAME seat at once. Here `oe_booked_seats`
-- carries a UNIQUE(event_id, seat_label) constraint; the oe_claim_seats() RPC
-- (used by the P4 booking fn) inserts all requested seats in one atomic
-- statement — any collision aborts the whole claim. Real double-booking is
-- impossible at the database level.
-- ════════════════════════════════════════════════════════════════════════

-- ── Floor plans ─────────────────────────────────────────────────────────
-- A visual hall layout ({columns, rows, stage, door, tables[]}) stored as JSON.
-- `physical_seats` is a denormalized count of ENABLED seats (physical minus
-- missing/disabled) so the capacity RPC never has to parse the JSON in SQL;
-- the P8 editor recomputes it on every save.
create table if not exists public.oe_floor_plans (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  is_default     boolean not null default false,
  layout_data    jsonb not null default '{}'::jsonb,
  physical_seats integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- At most one default plan.
create unique index if not exists oe_floor_plans_one_default
  on public.oe_floor_plans (is_default) where is_default = true;

-- ── Events (was event_dates) ────────────────────────────────────────────
-- Each event carries its OWN price (owner decision 2). `capacity` null → fall
-- back to the linked floor plan's physical_seats. status: live | display | off.
create table if not exists public.oe_events (
  id                     uuid primary key default gen_random_uuid(),
  display_label          text not null,
  start_date             date not null,
  end_date               date not null,
  time_slot              text not null default '',
  status                 text not null default 'live'
                           check (status in ('live','display','off')),
  price_per_seat         numeric(10,2) not null default 0,
  capacity               integer,                       -- null → derive from floor plan
  theme_zh               text,
  theme_en               text,
  notice_zh              text,
  notice_en              text,
  floor_plan_id          uuid references public.oe_floor_plans(id) on delete set null,
  seat_selection_enabled boolean not null default true,
  sort_order             integer not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists oe_events_status_idx on public.oe_events (status);
create index if not exists oe_events_sort_idx   on public.oe_events (sort_order, start_date);

-- ── Bookings (was bookings) ─────────────────────────────────────────────
-- status: pending (awaiting Stripe payment) | confirmed (free, or paid+webhook)
--         | cancelled. event_label is a display snapshot so history survives
-- event deletion (event_id then set null).
create table if not exists public.oe_bookings (
  id                uuid primary key default gen_random_uuid(),
  booking_id        text not null unique,               -- human code BK-XXXX-YYYY
  event_id          uuid references public.oe_events(id) on delete set null,
  event_label       text not null default '',
  email             text not null default '',
  phone             text not null default '',
  free_seats        text[] not null default '{}',       -- seat labels, e.g. "G5 Seat 1"
  addon_seats       text[] not null default '{}',
  lunch_qty         integer not null default 0,
  subtotal          numeric(10,2),
  sst_amount        numeric(10,2),
  total             numeric(10,2) not null default 0,
  status            text not null default 'pending'
                      check (status in ('pending','confirmed','cancelled')),
  payment_intent_id text,
  stripe_session_id text,
  receipt_url       text,
  payment_note      text,
  day1_status       text not null default 'pending'
                      check (day1_status in ('pending','attended','not_attending')),
  day2_status       text not null default 'pending'
                      check (day2_status in ('pending','attended','not_attending')),
  qr_payload        text not null default '',
  ghl_location_id   text,                                -- the Sub Account (nullable, NO FK)
  is_archived       boolean not null default false,
  archived_at       timestamptz,
  created_by        text,                                -- null | 'admin' | 'customer'
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists oe_bookings_event_idx    on public.oe_bookings (event_id);
create index if not exists oe_bookings_location_idx on public.oe_bookings (ghl_location_id);
create index if not exists oe_bookings_status_idx   on public.oe_bookings (status);
create index if not exists oe_bookings_email_idx    on public.oe_bookings (lower(email));
create index if not exists oe_bookings_created_idx  on public.oe_bookings (created_at desc);

-- ── Booked seats (the atomic seat lock) ─────────────────────────────────
-- One row per claimed seat. UNIQUE(event_id, seat_label) makes double-booking
-- impossible. Rows are created when a booking is placed (pending seats are held
-- during checkout) and cascade-deleted if the booking or event is removed.
-- For seat-selection-disabled (quantity-only) events the booking fn passes
-- per-booking synthetic labels so they never collide; capacity is still enforced.
create table if not exists public.oe_booked_seats (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.oe_events(id) on delete cascade,
  seat_label  text not null,
  booking_id  uuid not null references public.oe_bookings(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (event_id, seat_label)
);
create index if not exists oe_booked_seats_booking_idx on public.oe_booked_seats (booking_id);

-- ── Per-Sub-Account free allowance (was ghl_subaccount_settings) ─────────
-- Tool ENABLE/DISABLE is owned by the platform location_tool_access(offline_event)
-- toggle (Admin Portal), NOT here — so no is_enabled column. This table only
-- holds each Sub Account's free ticket allowance (default 1 slot = 2 seats,
-- owner decision 5). Rows are auto-created on first visit (via the oe edge fn).
create table if not exists public.oe_subaccount_settings (
  location_id   text primary key,
  free_tickets  integer not null default 1,
  free_seats    integer not null default 2,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Global settings (was app_settings) ──────────────────────────────────
create table if not exists public.oe_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- ── RLS: service role only (no policy on purpose) ───────────────────────
alter table public.oe_floor_plans        enable row level security;
alter table public.oe_events             enable row level security;
alter table public.oe_bookings           enable row level security;
alter table public.oe_booked_seats       enable row level security;
alter table public.oe_subaccount_settings enable row level security;
alter table public.oe_settings           enable row level security;

-- ════════════════════════════════════════════════════════════════════════
-- Atomic seat claim RPC (used by the P4 booking edge fn).
-- Returns true if all seats were claimed under capacity; false on a full house
-- or ANY seat collision (nothing is left half-claimed).
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.oe_claim_seats(
  p_event_id   uuid,
  p_booking_id uuid,
  p_seats      text[]
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap  integer;
  v_taken integer;
  v_want integer := coalesce(array_length(p_seats, 1), 0);
begin
  if v_want = 0 then
    return true;                                    -- nothing to claim
  end if;

  -- Effective capacity: explicit event cap, else the floor plan's seat count,
  -- else NULL = unlimited (seat uniqueness still applies).
  select coalesce(e.capacity, fp.physical_seats)
    into v_cap
  from public.oe_events e
  left join public.oe_floor_plans fp on fp.id = e.floor_plan_id
  where e.id = p_event_id;

  if v_cap is not null and v_cap > 0 then
    select count(*) into v_taken
    from public.oe_booked_seats
    where event_id = p_event_id;
    if v_taken + v_want > v_cap then
      return false;                                 -- would exceed capacity
    end if;
  end if;

  -- Atomic all-or-nothing claim. A duplicate (event_id, seat_label) raises
  -- unique_violation, which aborts the INSERT and is caught below → false.
  insert into public.oe_booked_seats (event_id, seat_label, booking_id)
  select p_event_id, s, p_booking_id
  from unnest(p_seats) as s;

  return true;
exception
  when unique_violation then
    return false;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- SEED
-- ════════════════════════════════════════════════════════════════════════

-- Default settings (owner decisions 3, 4, 7 + Stripe test mode to start).
insert into public.oe_settings (key, value) values
  ('stripe_payment_mode', 'sandbox'),
  ('sst_rate', '0.08'),
  ('lunch_price', '39.99'),
  ('max_seats_per_booking', '4')
on conflict (key) do nothing;

-- Default floor plan = the old QAI hall (6 columns of 4-seat cluster tables,
-- G1–G28). G17 is missing seat 2; G24–G28 are disabled by default. Built from
-- a compact spec so the JSON + enabled-seat count stay in sync.
do $$
declare
  v_tables jsonb;
  v_seats  integer;
  v_plan_id uuid;
begin
  if not exists (select 1 from public.oe_floor_plans) then
    with spec(id, col, row, missing, disabled) as (
      values
        ('G1',1,0,'{}'::int[],'{}'::int[]),
        ('G2',1,1,'{}'::int[],'{}'::int[]),
        ('G3',1,2,'{}'::int[],'{}'::int[]),
        ('G4',1,3,'{}'::int[],'{}'::int[]),
        ('G5',2,0,'{}'::int[],'{}'::int[]),
        ('G6',2,1,'{}'::int[],'{}'::int[]),
        ('G7',2,2,'{}'::int[],'{}'::int[]),
        ('G8',2,3,'{}'::int[],'{}'::int[]),
        ('G9',3,0,'{}'::int[],'{}'::int[]),
        ('G10',3,1,'{}'::int[],'{}'::int[]),
        ('G11',3,2,'{}'::int[],'{}'::int[]),
        ('G12',3,3,'{}'::int[],'{}'::int[]),
        ('G13',3,4,'{}'::int[],'{}'::int[]),
        ('G14',4,0,'{}'::int[],'{}'::int[]),
        ('G15',4,1,'{}'::int[],'{}'::int[]),
        ('G16',4,2,'{}'::int[],'{}'::int[]),
        ('G17',4,3,'{2}'::int[],'{}'::int[]),
        ('G18',4,4,'{}'::int[],'{}'::int[]),
        ('G19',5,0,'{}'::int[],'{}'::int[]),
        ('G20',5,1,'{}'::int[],'{}'::int[]),
        ('G21',5,2,'{}'::int[],'{}'::int[]),
        ('G22',5,3,'{}'::int[],'{}'::int[]),
        ('G23',5,4,'{}'::int[],'{}'::int[]),
        ('G24',6,0,'{}'::int[],'{1,2,3,4}'::int[]),
        ('G25',6,1,'{}'::int[],'{1,2,3,4}'::int[]),
        ('G26',6,2,'{}'::int[],'{1,2,3,4}'::int[]),
        ('G27',6,3,'{}'::int[],'{1,2,3,4}'::int[]),
        ('G28',6,4,'{}'::int[],'{1,2,3,4}'::int[])
    )
    select
      jsonb_agg(
        jsonb_build_object(
          'id', id, 'label', id, 'shape', 'cluster', 'col', col, 'row', row,
          'seats', '[1,2,3,4]'::jsonb,
          'missingSeats', to_jsonb(missing),
          'disabledSeats', to_jsonb(disabled)
        ) order by col, row
      ),
      sum(
        (select count(*) from generate_series(1,4) n
         where not (n = any(missing)) and not (n = any(disabled)))
      )
    into v_tables, v_seats
    from spec;

    insert into public.oe_floor_plans (name, is_default, physical_seats, layout_data)
    values (
      'QAI Hall (default)',
      true,
      v_seats,
      jsonb_build_object(
        'columns', 6, 'rows', 5, 'stage', true, 'door', 'bottom-right',
        'tables', v_tables
      )
    )
    returning id into v_plan_id;

    -- Sample upcoming events (owner replaces these in the P7 admin). Price 397.
    insert into public.oe_events
      (display_label, start_date, end_date, time_slot, status, price_per_seat,
       floor_plan_id, seat_selection_enabled, sort_order, theme_en, theme_zh)
    values
      ('25 - 26 July 2026 (Sat - Sun)', '2026-07-25', '2026-07-26',
       '10:00 AM - 6:00 PM', 'live', 397, v_plan_id, true, 1,
       'Q.AI 2 Days Profit Marketing Bootcamp', 'Q.AI 两天盈利营销训练营'),
      ('29 - 30 August 2026 (Sat - Sun)', '2026-08-29', '2026-08-30',
       '10:00 AM - 6:00 PM', 'live', 397, v_plan_id, true, 2,
       'Q.AI 2 Days Profit Marketing Bootcamp', 'Q.AI 两天盈利营销训练营'),
      ('26 - 27 September 2026 (Sat - Sun)', '2026-09-26', '2026-09-27',
       '10:00 AM - 6:00 PM', 'live', 397, v_plan_id, true, 3,
       'Q.AI 2 Days Profit Marketing Bootcamp', 'Q.AI 两天盈利营销训练营');
  end if;
end $$;
