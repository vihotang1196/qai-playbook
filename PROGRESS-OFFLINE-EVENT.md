# QAI Offline Event — Rebuild Progress

Rebuild of **Offline Event** (5th migrated tool) into this Playbook project,
ported from a Lovable export. It is a **line-up event booking system**: pick an
event date → choose seats on a floor-plan seat map → add lunch → **pay via
Stripe (MYR + 8% SST)** → get a **QR e-ticket on the web page** → staff **scan
the QR to check in** (2-day event: day1/day2). **IN PROGRESS — P0–P6 DONE (booking +
payment + e-ticket + BOTH check-in halves); P7 admin (bookings/event-dates/settings) is next.**

This file records the owner's locked decisions, the old-version facts, and the
phased plan so a new session can pick up without re-researching.

_Last updated: 2026-07-22 — **P0–P6 DONE (P6 admin check-in landed), ALL committed +
pushed to `feat/offline-event`.** P6 admin half = QR check-in: admin picks the active
event + Day 1/2, opens the scanner (native BarcodeDetector + `jsqr` fallback + manual
BK-code entry), scans the customer's ticket QR → requireAdmin-gated `offline-event-admin`
fn `checkIn` action marks day1/day2 attended, **IDEMPOTENT** (guarded `.eq(dayCol,'pending')`
so a re-scan reports "already" and never double-counts) and **LOCKED to the chosen event**
(a ticket for another event is refused). Live board "已签 X/Y" + recent list + check-in
time (new additive migration `20260722160000` added `day1_checked_in_at`/`day2_checked_in_at`
to oe_bookings). **Verified live** (owner admin session in preview): happy path
(BK-1QUH-ZB6UPG → 签到成功, board 0/1→1/1, 02:28 PM), re-scan → "已签到" (no double-count),
Sept ticket on July door → "不是本场活动的票", bogus code → "查无此票"; curl anon/garbage/
no-token → 403; tsc (offline-event) + vite build clean. NOTE: the July test booking
BK-1QUH-ZB6UPG is now day1=attended from that live test (test data, cleared in P7). P5 =
paid booking via Stripe **Hosted Checkout**
(owner chose redirect over embedded), DIRECT Stripe (no Lovable gateway), dual-key
(sandbox→_TEST / live→_LIVE from oe_settings.stripe_payment_mode). **NO webhook (owner
pivot):** /checkout/return hands the session_id to the `confirmBooking` oe action →
server RETRIEVES the session with the secret key → confirms ONLY if Stripe says paid
(browser never trusted); stale unpaid holds released by lazy `sweepStalePending`
(verifies with Stripe first, so a late-paid order is promoted not dropped);
`oe-stripe-webhook` fn deployed but DORMANT (future backstop). Owner set
OE_STRIPE_SECRET_KEY_TEST + _LIVE (webhook secrets not needed). **Full pay test
PASSED** (card 4242 → BK-1QUH-ZB6UPG confirmed, RM 857.52, server-verified). P6a =
customer "我的报名" = **team view** (lists ALL confirmed tickets under the location_id,
no email step, colleagues share, location-isolated server-side). **NEXT = P7 admin**
(bookings list/search/change/archive · event-date CRUD · Stripe mode/SST/lunch/free-allowance settings).
**TEST DATA TO CLEAN IN P7:** **July** event = BK-1QUH-ZB6UPG (4 confirmed seats G16
Seat 1–4, loc oe-mytest-1, the real pay test); **September** event = the P4 seed-test
seats (G1S1/G5S1/G5S2/G10S1 + 3 confirmed test bookings on test-verify-001/oe-conc-b/
oe-ui-demo) plus any leftover unpaid probe holds (self-sweep ~35min). Detail per phase
below._

## Where to build it
- **Old version (read-only reference):** `C:\Users\chais\Projects\QAI Offline Event`
  (a Lovable export; DO NOT edit it, DO NOT copy it wholesale). Source zip was
  `C:\Users\chais\Downloads\Q.AI Offline Class.zip` ("Offline Class" = this tool).
  Old Supabase project `fwzkpaznfhjerdvcbpbe` — do NOT reuse.
- **New branch:** ✅ `feat/offline-event` cut from `feat/admin-portal` — has the
  reusable Admin Portal auth (requireAdmin + `platform_admins` + light admin
  shell), shared `ghl_locations` + `sync-ghl-locations` + `location_tool_access`
  + `tool_usage`, and the `_shared/*` Deno helpers.
- **Supabase:** reuse the shared **Playbook** project `hkqzzfyigmvisaftdmwh` (hkqzz).
- **Migration-history note:** this branch (cut from admin-portal) also carries the
  4 **helpdesk** migration FILES (`20260718*`–`20260720*`), byte-identical to
  `feat/helpdesk`. They are NOT helpdesk code — they keep the local migration
  history in sync with the shared hkqzz DB (which already has hd_ applied) so
  `supabase db push` stays clean, and so a future merge to `main` (after helpdesk
  merges) reconciles without conflict. Leave them.

## Owner decisions (locked 2026-07-21)
1. **Full port** — booking + seat selection + payment + e-ticket + check-in.
   **Email dropped for now** — the web page shows a QR e-ticket instead (customer
   screenshots it; staff scan on event day). Add email later if wanted.
2. **Per-event price** — each event carries its OWN `price_per_seat` (on
   `oe_events`), not hardcoded. Lunch price lives in `oe_settings`.
3. **SST 8%** on all PAID orders; free tickets add no SST (0 subtotal → 0 SST).
4. **Max 4 tickets per booking** (kept from old app).
5. **Default free allowance per Sub Account = 1 slot = 2 free seats** (kept).
6. **Customer URL = `/events?location_id=xxx`** — inside `<Layout>` (Playbook
   navbar + footer), identity = trust-the-URL `location_id`, reuse Helpdesk's
   tab-wide location_id persistence pattern.
7. **Add-ons = lunch only** (yes/no + qty). The old app's 6 food items are NOT ported.
8. **Payment = Stripe, "paid" server-verified & un-fakeable** (old app trusted the
   browser). ORIGINALLY planned via a webhook; **changed 2026-07-22** to return-page
   server-side verification (`confirmBooking` retrieves the session with the secret
   key) — simpler to run, still safe (verification is server-side). Webhook code kept
   dormant as a future backstop. SST 8% on paid orders; test mode (sandbox) first.
9. **Security rewrite (must):** admin = Admin Portal `requireAdmin`; ALL
   booking/change/check-in go through location-scoped Edge Functions; the
   frontend NEVER touches oe_ tables with the anon key (closes the old app's
   privacy hole where anon read the whole bookings table).
10. **Branch `feat/offline-event` from `feat/admin-portal`, prefix `oe_`,
    register `offline_event` in the tool registry.**

## Old-version facts (from read-only research, so we don't re-dig)
Product: a **2-day offline class booking + seat-selection + Stripe payment +
QR check-in** app. Bilingual EN/中文. Customer books via a GHL sub-account link;
admin manages events/seats/bookings/check-in.

- **Identity (old):** customer via `/book?location_id={{location.id}}` (URL,
  trust-the-URL, auto-registers the sub-account on first visit). ADMIN was a
  **broken client-only mock** — `useAdminRole.signIn(email, "")` took ONLY an
  email (no password), or `?key=qai-admin` in the URL → instant admin; anon key
  read `admin_users` directly. **Must be replaced** with requireAdmin (decision 9).
- **Backend (old):** almost none. The frontend wrote `bookings` etc. DIRECTLY via
  the anon key (`bookingStore.ts`), RLS wide open (privacy hole). No Stripe
  webhook — the browser created the booking + wrote "paid" itself. Only Stripe
  (`create-checkout`, `get-receipt`) + a Lovable-hosted email queue were real
  server code. GHL sub-accounts were live-listed (no shared table).
- **Old data model** (final schema): `bookings` (email/phone, event_date+end_date,
  free_seats[]/addon_seats[], lunch_qty, subtotal/sst_amount/total,
  payment_intent_id/receipt_url, qr_payload, day1_status/day2_status,
  ghl_location_id, is_archived), `event_dates`, `floor_plans` (layout_data JSON),
  `ghl_subaccount_settings` (is_enabled + free_tickets/free_seats), `admin_users`,
  `app_settings` (stripe_payment_mode, capacity_limit:<label>), + email tables.
  RPCs: `try_book_seats` (aggregate head-count only — did NOT prevent same-seat
  double-booking) + a pgmq email queue.
- **Booking flow (old, single page, phased):** list events → seat map (or a
  quantity stepper if seat-selection disabled) → lunch yes/no + qty → order
  summary (email) → submit. Free (total ≤ 0) books instantly; paid opens a Stripe
  Embedded Checkout dialog → `/checkout/return` stashes session_id → the page
  finalizes the booking from a localStorage draft + fetches the receipt.
- **Seat model:** `floor_plans.layout_data` = `{columns, rows, stage, door,
  tables[]}`; each table = `{id,label,shape:"cluster"(4)|"long"(6),col,row,
  seats[],missingSeats[],disabledSeats[]}`. Seat label = `"G5 Seat 1"`. Default
  hall = G1–G28 (6 cols × ~5 rows); G17 missing seat 2; G24–G28 disabled by default.
- **Pricing (old):** RM397/seat, lunch RM39.99/person, SST 8%.

## Phased plan (owner-approved 2026-07-21)
Each phase is committed + pushed to `feat/offline-event` when done.
Order: scaffold+DB+security → customer booking+seats → payment webhook →
e-ticket+check-in → admin+seat editor → polish.

- [x] **P0 — Scaffold (2026-07-21).** Cut branch. Register `offline_event` in the
  tool registry (`src/lib/admin/tools.ts` ADMIN_TOOLS `live:false` until P3 +
  `admin` fn `KNOWN_TOOLS`). Customer route `/events` (inside `<Layout>`, navbar+
  footer) → `EventsPage.tsx` placeholder (reads URL `location_id`). Admin nested
  in the Admin Portal at `/admin/offline-event/*` via `OfflineEventAdminShell`
  (sub-tabs: 总览/报名/活动日期/平面图/签到/设置) + placeholder `sections.tsx`.
  Nav item in `AdminLayout` + card in `AdminHome`. Files:
  `src/pages/events/EventsPage.tsx`, `src/components/offline-event/
  OfflineEventAdminShell.tsx`, `src/pages/admin/offline-event/sections.tsx`,
  routes in `src/App.tsx`, `AdminLayout.tsx`, `AdminHome.tsx`, registry edits.
  **Verified:** tsc clean; `/events?location_id=…` renders inside Layout with the
  id shown; `/admin/offline-event` renders the nested shell (owner admin session
  present in the preview browser) + sub-tab nav works; no console errors.
- [x] **P1 — DB + seed (2026-07-21).** Migration `20260721120000_offline_event_phase1.sql`
  (additive; already applied to hkqzz + REST-verified). Tables (all `oe_`, RLS ON
  + NO policy = service-role only): `oe_floor_plans` (layout_data jsonb +
  denormalized `physical_seats`, one-default partial unique index), `oe_events`
  (per-event `price_per_seat`, nullable `capacity` → derive from plan,
  status live/display/off, floor_plan_id FK, bilingual theme/notice),
  `oe_bookings` (status pending/confirmed/cancelled, free/addon seats[],
  subtotal/sst/total, payment_intent_id/stripe_session_id/receipt_url,
  day1/day2_status, qr_payload, ghl_location_id nullable no-FK, is_archived),
  `oe_booked_seats` ⭐ (the atomic seat lock), `oe_subaccount_settings`
  (free_tickets/free_seats default 1/2 — NO is_enabled; tool on/off is owned by
  `location_tool_access(offline_event)`), `oe_settings` (k/v). NOT ported:
  `admin_users` (use platform_admins), all email tables (decision 1),
  capacity_limit app_settings keys (capacity now on oe_events).
  Seed: default **QAI Hall** floor plan (G1–G28, G17 missing seat 2, G24–G28
  disabled) + 3 sample live events (25–26 Jul / 29–30 Aug / 26–27 Sep 2026, price
  397) + settings (stripe_payment_mode=sandbox, sst_rate=0.08, lunch_price=39.99,
  max_seats_per_booking=4). **Verified:** all 6 oe_ tables → anon `200 []` (exist +
  RLS blocks seed rows); non-existent table → 404 (control); rb_*/ghl_locations/
  platform_admins/location_tool_access/tool_usage/admin_audit_log intact.
  Seed presence guaranteed by the transactional migration (version recorded remote
  only on full success) — will be VISIBLY confirmed in P2's overview counts.
  - **KEY DESIGN — atomic seat lock (more robust than the old app):** `oe_booked_seats`
    has `UNIQUE(event_id, seat_label)`; the `oe_claim_seats(event_id, booking_id,
    seats[])` RPC (used by the P4 booking fn) checks capacity then INSERTs all
    requested seats in ONE statement — any duplicate raises `unique_violation`,
    aborting the whole claim → returns false. Same-seat double-booking is
    impossible at the DB level (old `try_book_seats` only checked head-count).
    For seat-selection-disabled events, the booking fn passes synthetic per-booking
    labels so they never collide while capacity is still enforced.
- [x] **P2 — Admin login + shell wired + live overview (2026-07-21).**
  `offline-event-admin` edge fn (kept separate from the platform `admin` fn,
  mirrors `helpdesk-admin`): every action gated by `requireAdmin` before any
  service-role work, `verify_jwt=false` at the gateway. Ships `overview` — live
  cap-free COUNTs (events total/live, floor plans, bookings total/confirmed/
  pending, seats claimed) + revenue (sum of confirmed totals; pre-scale TODO:
  SQL sum RPC). Files: `supabase/functions/offline-event-admin/index.ts` +
  config.toml, `src/lib/offlineEventAdmin.ts` (session-authed client, adminApi
  pattern), `src/pages/admin/offline-event/Overview.tsx` (count tiles; replaced
  the sections.tsx OEOverview placeholder + rewired App.tsx). **Verified live**
  (deployed to hkqzz): with the owner's admin session the Overview shows the
  seeded **3 events (3 live) + 1 floor plan**, 0 bookings, RM 0.00 — visible
  confirmation the P1 seed landed; anon key / garbage token / no token all → 403
  not_authorized; tsc clean; no console errors.
- [x] **P3 — Customer identity + event list + seat map (read-only) (2026-07-21).**
  Public `oe` edge fn (location-scoped, verify_jwt=false, service-role internally;
  mirrors `rb`): `resolveContext` (auto-registers the sub-account via the SERVICE
  ROLE — not anon; gates on `hasToolAccess(offline_event)`; returns free-ticket
  balance + best-effort business name), `listEvents` (live/display + per-event
  effective capacity + seats-left), `getEvent` (event + floor plan + claimed seat
  labels). Frontend: ported the 3 tool-neutral location helpers from feat/helpdesk
  into `src/lib/ghl.ts` (`rememberLocationId`/`getStoredLocationId`/
  `resolveLocationId`, sessionStorage `pb_location_id`) + a `<LocationIdKeeper>` in
  App.tsx (stash on every route). `src/lib/offlineEvent.ts` (oe client + seat-map
  types + `layoutToSeatGroups`). `src/components/offline-event/SeatMap.tsx` (ported
  VERBATIM visual from the old app; only change = the old `t("seat.*")` i18n keys,
  absent here, inlined as `lang === "cn" ? … : …`; read-only). `EventsPage.tsx`
  rewritten: no location_id → `OpenFromQai` gate (QAI-worded, app.qiai.tech copy
  link, NO "GHL"); tool off → `ToolDisabled` notice; else event cards + expandable
  read-only seat map + free-ticket balance. Flipped `offline_event` to `live:true`
  (tools.ts). **Redeployed `admin` fn** so its KNOWN_TOOLS (offline_event, added in
  P0 source) is live — needed for the sub-accounts offline_event toggle + the
  tool-access gate. **Verified live** (deployed `oe`; tsc clean; no console errors):
  `?location_id=test-verify-001` → 3 seeded events (RM397, 剩91座) + free balance
  "你还有 2 张免费票" + the QAI-hall seat map renders (舞台 + G1–G23 cluster tables,
  G24–G28 correctly hidden, legend); bare `/events` (sessionStorage cleared) → QAI
  gate; toggling offline_event OFF for a real location (Ong pei shirl) via the admin
  fn → `oe` returns `{enabled:false}` (→ ToolDisabled) → toggled back ON restores;
  two different location_ids resolve independent context; anon still can't read the
  oe_ tables (P1 RLS). NOTE: events + hall are SHARED across sub-accounts by design
  (one bootcamp, one hall); per-location = free allowance + (from P4) bookings.
- [x] **P4 — Booking submit (free + atomic seat claim) ⭐ (2026-07-21).** `oe` fn
  `createBooking` — everything validated + priced SERVER-SIDE (never trust the
  frontend): tool access, event bookable (status=live), seat count 1..maxSeats
  (oe_settings.max_seats_per_booking=4), per-location free-ticket accounting
  (free_seats − used across the location's active bookings), pricing
  (paidSeats×price + lunch×lunch_price, +8% SST when subtotal>0). **total > 0 →
  returns `{requiresPayment, breakdown}` and writes NOTHING** (Stripe = P5). **total
  ≤ 0 (free) → inserts oe_bookings (status confirmed) then calls the atomic
  `oe_claim_seats` RPC**; a UNIQUE(event_id,seat_label) collision OR capacity
  overflow returns false → the just-created booking row is rolled back (deleted) →
  `{error:"seats_unavailable"}` (409). Generates the QR payload (JSON). Also
  extended `resolveContext` to return settings (maxSeats/lunchPrice/sstRate) so the
  client can preview pricing + cap selection. Frontend (`EventsPage.tsx`): the seat
  map is now SELECTABLE (cap = min(4, seats_left)); a booking panel (selected
  seats + optional lunch stepper + email + live price preview) → 确认免费报名; free
  success shows a QR ticket (`qrcode.react` QRCodeSVG) + booking id + seats; paid
  shows a "付款即将开放 (P5)" breakdown; `seats_unavailable` → toast + reloads the
  map. `src/lib/offlineEvent.ts` gained createBooking + types. **Verified live**
  (deployed `oe`; tsc clean; no console errors): (1) FREE booking via curl → ok +
  qr; (2) **CONCURRENCY — two locations grabbing the SAME seat in parallel → exactly
  ONE ok, one `seats_unavailable`** (atomic claim proven); (3) free used up → 2 seats
  = 1 free + 1 paid → `requiresPayment` total RM428.76 (397 + 8% SST 31.76), no
  write; (4) 5 seats → `too_many_seats`; (5) full UI booking (oe-ui-demo, G5 Seat
  1+2) → 报名成功 + real QR (BK-W4ZJ-NE3RDY); then that location's freeSeatsRemaining
  0 / used 2, Sept bookedSeats grew to 4, seats_left 91→87. Per-location isolation:
  free allowance + bookings tagged by ghl_location_id; events + hall shared by design.
  RESIDUAL (P5/hardening): the free-allowance check isn't itself concurrency-atomic
  (two simultaneous free bookings for the SAME location could each pass the check and
  slightly overspend the free allotment) — low-harm vs seat double-booking (which IS
  atomic); tighten later if needed. NOTE (pre-launch test data): the **September**
  event now holds 4 test booked seats (G1S1/G10S1/G5S1/G5S2) + 3 confirmed test
  bookings on test locations (test-verify-001 / oe-conc-b / oe-ui-demo) — July +
  August are pristine. Remove the test rows via the P7 bookings admin.
- [x] **P5 — Paid booking + Stripe ⭐ (DONE 2026-07-22 — full pay test PASSED).**
  Owner chose **Hosted Checkout** (redirect, not embedded) and (pivot)
  **return-page server-side verification instead of a webhook**. Implemented as:
  `createCheckout` + `getBooking` + `confirmBooking` ACTIONS on the existing `oe` fn
  (NOT a separate `oe-checkout` fn — reuses P4 pricing/free-allowance/atomic seat-claim,
  extracted into shared `computeBookingPlan()` so free + paid can't price differently).
  Money-safe flow: "pay" → re-price server-side → write PENDING booking → **atomic
  `oe_claim_seats` BEFORE any Stripe call** (seat taken → 409, money untouched) → hosted
  session (2 line items subtotal + SST 8%; `expires_at` now+~32min; metadata.bookingId;
  success_url `/checkout/return?booking=…&session={CHECKOUT_SESSION_ID}`) → redirect.
  **Confirm:** `/checkout/return` polls `confirmBooking(session_id)` → server does
  `stripe.checkout.sessions.retrieve` → confirms ONLY if payment_status=paid, guarded
  `.eq(status,pending)` = idempotent (seats already held; nothing re-claimed). **Seat
  release (no webhook):** `sweepStalePending` on getEvent(by event)/createBooking+
  createCheckout(by location) reconciles pending >35min — Stripe-verifies each before
  releasing (late-paid → promoted to confirmed, else cancelled + booked_seats deleted).
  `oe-stripe-webhook` fn deployed but DORMANT (future backstop). Frontend: paid button
  → `createCheckout` → redirect; return page → shared `QrTicket` on confirmed. Footer
  copy updated (payment live, not "coming soon"). `_shared/stripe.ts` = makeStripeClient
  + resolveOeStripe (mode→secret, ONE source of truth). **Verified:** tsc clean; oe +
  webhook deployed; regression intact; createCheckout origin_required/no_payment_required,
  confirmBooking missing_reference + **UNPAID session stays pending** + wrong-location→
  not_found; **real sk_test_ session created (cs_test_…)**; **real booking UI redirects
  to Stripe hosted checkout (Sandbox / MYR / AJ ENDLESS ASIA SDN BHD, email prefilled).**
  TEST DATA TO CLEAN (P7): pending holds on SEPT — BK-NSKG-9L2TE7 (G20 Seat 3, loc
  oe-p5-stripe-check) + the browser-test hold G14 Seat 1 (loc oe-e2e-001, self-sweeps
  ~35min if unpaid). **Full pay test PASSED** (4242 → BK-1QUH-ZB6UPG confirmed,
  RM 857.52, server-verified: pending→confirmed + QR). Optional future: add webhook backstop.
- [x] **P6 — E-ticket + QR + check-in (DONE 2026-07-22 — both halves).**
  **CUSTOMER HALF: "我的报名"
  / My bookings — TEAM VIEW (owner changed scope A→team on 2026-07-22).** A location =
  one team/company, so it lists EVERY confirmed ticket under the location_id (colleagues
  share; NO email step). `oe` fn `listMyBookings` action: scoped SERVER-SIDE by
  `ghl_location_id` + status=confirmed only (pending/cancelled hidden), event dates
  embedded via `oe_events(...)`, newest event first, each row carries its booker `email`
  so the team can tell tickets apart. Location isolation kept (A company never sees B's).
  Front: `MyBookings.tsx` self-contained modal (no shadcn dep) opened by a "我的报名"
  header button on /events — auto-loads the location's tickets on open (no input), each
  shows theme/date/booker-email/seats/code → tap → big QR via shared `QrTicket`. (Dropped
  the email input + the `rememberBookingEmail`/`getStoredBookingEmail` helpers.)
  **Verified:** tsc clean; oe deployed; curl — location lists its confirmed booking (no
  email arg), other-location→[]; browser — button→modal shows the team ticket
  (chaishaofeng3@gmail.com, G16 1-4) directly + QR, and a different location shows
  "没有报名" (isolation); no console errors (the getStoredBookingEmail errors seen mid-
  edit were stale HMR residue).
  **ADMIN HALF DONE (2026-07-22): QR check-in.** New page `src/pages/admin/offline-event/
  CheckIn.tsx` (replaces the sections.tsx OECheckIn placeholder; rewired App.tsx) — admin
  picks the active event (smart default = ongoing today → nearest upcoming → last) + Day 1/2
  (smart default by today's date), opens `src/components/offline-event/CheckInScanner.tsx`
  (self-contained modal, no shadcn; native `BarcodeDetector` + `jsqr` canvas fallback +
  always-on manual BK-code entry). Scan → parse QR JSON `{bookingId,…}` (or raw code) →
  `offline-event-admin` fn `checkIn` action. Server: requireAdmin → find CONFIRMED booking
  by code → **wrong-event guard** (b.event_id !== chosen eventId → refused, 锁定本场) →
  flip dayN pending→attended **guarded `.eq(dayCol,'pending')` = IDEMPOTENT** (re-scan or a
  race → "already", never double-counts) + stamp `dayN_checked_in_at`. Also `checkinEvents`
  (event picker) + `checkinBoard` (live 已签 X/Y + last-20 recent, refreshed after each ok).
  Client fns in `offlineEventAdmin.ts`. Additive migration `20260722160000_offline_event_
  p6_checkin.sql` added the two timestamp columns (dry-run→push; local==remote). Added dep
  `jsqr@^1.4.0`. **Verified live** (owner admin session in preview, offline-event-admin
  redeployed): happy path BK-1QUH-ZB6UPG Day 1 → 签到成功, board 0/1→1/1 100% + 02:28 PM +
  recent list; re-enter same → amber "已签到 (02:28 PM)", board stays 1/1 (no double-count);
  Sept ticket BK-W4ZJ-NE3RDY on July door → red "不是本场活动的票 · 属于 26–27 Sept"; bogus
  code → "查无此票"; curl anon/garbage/no-token → 403 not_authorized; vite build + tsc
  (offline-event files) clean; no console errors. Self-check-in (old app had it) DROPPED for
  now (not needed for MVP; add later if wanted). Note: BK-1QUH-ZB6UPG is now day1=attended
  from the live test (July test data, wiped in P7).
- [~] **P7 — Admin: bookings + event-dates + settings (IN PROGRESS).** Split into
  sub-blocks (owner-approved 2026-07-22), each its own commit:
  - [x] **P7a — Bookings list/search/detail + cancel + archive (DONE 2026-07-22).**
    `offline-event-admin` fn: `listBookings` (filters event/status/location + BK-code/email
    search, sanitized against PostgREST or()-injection, + exact count), `getBookingDetail`
    (+ its event), `cancelBooking` (status→cancelled + DELETE its `oe_booked_seats` = frees
    the seat + free-allowance, keeps row; note appended, idempotent), `archiveBooking`
    (toggle is_archived, hidden from default list). Light audit → `admin_audit_log`
    (oe_cancel_booking / oe_archive_booking). Frontend `Bookings.tsx` (filters + search +
    table + detail modal w/ QR via shared `QrTicket lang="cn"`, payment note, check-in
    times, Stripe receipt link) replaces the OEBookings placeholder; App.tsx rewired.
    **Two-action model (owner):** cancel frees seat + keeps as "已取消"; archive only hides.
    **Verified live** (owner admin session): 6 test bookings list + filters; detail shows
    BK-1QUH-ZB6UPG w/ "Stripe 857.52 MYR" + "Day 1 已到 02:28 PM" + QR; cancelled BK-RLUU →
    seat **G14 Seat 1 confirmed released** from Sept seat map; archived → list 6→5 + toggle
    to 取消归档; lazy stale-pending sweep observed auto-cancelling an old unpaid P5 hold
    (BK-NSKG); tsc (oe files) + no console errors. (Deferred to P7d cleanup: these test
    rows.)
  - [x] **P7a-2 — Manual add-ticket + change-seat + change-date (DONE 2026-07-22).**
    Owner: change-seat/date = **same seat count, money untouched** (change count/price →
    cancel+rebook). PLUS **manual add-ticket** (owner ask: some pay via 3rd party → admin
    creates a confirmed booking directly, seats→addon so no free-allowance spend, manual
    payment note, atomic claim). Additive migration `20260722180000_offline_event_p7_seat_ops`
    adds two RPCs — `oe_reassign_seats` (same event) + `oe_move_booking_seats` (cross event):
    capacity check FIRST, then delete-old+insert-new in ONE txn, `exception when
    unique_violation → return false` rolls back the delete too (old seats retained; siblings
    of `oe_claim_seats`, untouched). Admin fn actions: `listLocations` (sub-account picker),
    `getEventSeatmap` (layout + claimed labels, `excludeBookingId` frees a booking's own seats),
    `addBooking` (confirmed, created_by=admin, addon_seats, payment_note, oe_claim_seats),
    `changeSeats` (reassign, count must match, preserves free/paid split sizes), `changeEvent`
    (same event → reassign; else move; updates event_id/label + regen QR; booking_id STABLE so
    the customer's old QR still scans). Front: reusable `AdminSeatPicker` (wraps SeatMap,
    labels↔ids, skips already-booked seats when pre-selecting) + `ManualAddModal` +
    `SeatOpModal` (改座/改期); wired into Bookings.tsx (＋手动加票 button; 改座/改期 in detail).
    **Verified live** (owner session, API + UI): change-seat released old G10S1 + locked new
    G2S1; **collision** (move onto a taken seat) → 409 seats_unavailable AND kept the old seat
    (no double-book, no seat-less); change-date moved BK-SPL2 Sept→July (old released, new
    locked, booking now points at July); manual add BK-YSJ6 → confirmed + QR + **checked in OK**;
    manual-add modal renders 911-location picker + 182-seat map; 改座 modal enforces "需选 4" +
    91-seat map + 确认改座. tsc clean (only the pre-existing review-boost error). Left test
    rows for P7d.
  - [x] **P7b — Event-date CRUD (DONE 2026-07-22).** admin fn `listEventsAdmin` (all
    statuses + per-event claimed-seat + active-booking counts + floor-plan options),
    `createEvent`, `updateEvent`, `deleteEvent`. Fields: label, start/end dates, time_slot,
    theme zh/en, notice zh/en, price_per_seat, capacity (blank→derive from plan), floor_plan_id,
    seat_selection_enabled, status live/display/off, sort_order. **Guards (server-side):**
    delete blocked when active (non-cancelled) bookings exist → `has_bookings` (close via off
    instead); capacity can't drop below claimed → `capacity_below_claimed`; floor plan can't
    change once seats claimed → `cannot_change_plan_with_bookings`. All write audit. Front
    `EventDates.tsx` (list cards + create/edit form modal, all fields) replaces the placeholder;
    App.tsx rewired. **Verified live** (owner session): create ok; update price 500→600 +
    capacity→50 took effect; new live event appeared on customer `/events` (top, RM 250) then
    deleted; guard_delete July→has_bookings(2); guard_capacity July cap=1→capacity_below_claimed
    (claimed 5); guard_plan July→cannot_change_plan_with_bookings; admin list + 12-field form
    render; tsc clean.
  - [ ] **P7c — Settings.** Stripe mode toggle (server reads oe_settings.stripe_payment_mode
    at booking time → flip = next order uses that mode; strong confirm + live-key precheck +
    warn if pending in flight + prominent mode badge) · SST · lunch price · max seats ·
    free allowance (global default + per-subaccount overrides).
  - [ ] **P7d — Clean test data.** List all current (all test) → owner confirms → hard-delete
    the specific rows (cascades booked_seats) + test-location subaccount_settings; Overview
    → 0.
- [ ] **P8 — Admin: floor-plan visual editor.** Full drag-drop `FloorPlanEditor`
  (add/remove tables, cluster 4 / long 6, disabled seats, rows/cols, stage/door);
  floor-plan CRUD + set default + link to events; recompute `physical_seats` on save.
- [ ] **P9 — Polish + merge.** `/tools` cards, copy polish, merge to `main`.

## oe_ table map (old → new; built in P1)
`event_dates`→`oe_events` (+ per-event price) · `floor_plans`→`oe_floor_plans`
(+ physical_seats) · `bookings`→`oe_bookings` (+ status, stripe_session_id) ·
(new) `oe_booked_seats` (atomic seat lock) · `ghl_subaccount_settings`→
`oe_subaccount_settings` (free allowance only; no is_enabled) · `app_settings`→
`oe_settings` · `admin_users`→(dropped, use platform_admins) · email tables→(dropped).
RPC: `try_book_seats`→`oe_claim_seats` (seat-level atomic).

## Rules carried over (same as RB/Admin Portal/Helpdesk)
- Commit + push after every phase (owner lost unpushed work once).
- DB: dry-run then apply; only ADD oe_ tables; never touch other tools' tables.
- Backend keys (Stripe, GHL, Anthropic) only in Supabase Edge secrets (owner sets).
- Owner is non-technical: explain in Chinese, step by step, surface pros/cons for
  decisions, plan → confirm → build → verify in dev → commit+push.
- AI (Claude) is basically unused here (booking system) unless an obvious use appears.
