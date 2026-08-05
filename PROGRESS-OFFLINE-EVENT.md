# QAI Offline Event — Rebuild Progress

Rebuild of **Offline Event** (5th migrated tool) into this Playbook project,
ported from a Lovable export. It is a **line-up event booking system**: pick an
event date → choose seats on a floor-plan seat map → add lunch → **pay via
Stripe (MYR + 8% SST)** → get a **QR e-ticket on the web page** → staff **scan
the QR to check in** (2-day event: day1/day2). **IN PROGRESS — P0–P8 DONE (booking +
payment + e-ticket + check-in + full admin: bookings/manual-add/change/events/settings +
floor-plan visual editor + test data cleaned). P9 mostly done (see the P9 section);
what remains is the pre-launch checklist + merge to `main`.**

This file records the owner's locked decisions, the old-version facts, and the
phased plan so a new session can pick up without re-researching.

_Last updated: **2026-07-28** — see **“2026-07-23 → 07-28: platform work + P9”** near the
bottom for everything after 07-22 (this branch is now the trunk for ALL FIVE tools:
the Brutalist rebrand, rate limiting, the one-Playbook access switch, canary rollout,
the Helpdesk video AI, the free-allowance reset, and the E/F sub-account manager all
live here). The paragraph below is the 07-22 snapshot, kept for the P5/P6 detail._

_2026-07-22 snapshot — **P0–P6 DONE (P6 admin check-in landed), ALL committed +
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
- [x] **P7 — Admin: bookings + event-dates + settings (DONE 2026-07-22).** Split into
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
  - [x] **P7c — Settings (DONE 2026-07-22).** admin fn: `getSettings` (values +
    `liveKeyConfigured` bool + `pendingCount`), `updateSettings` (sst_rate as FRACTION,
    lunch_price, max_seats, default_free_tickets/seats — validated), `setStripeMode`,
    `listSubaccountSettings` / `updateSubaccountSettings`. **Stripe mode switch (money switch)
    — 3 safeguards, owner-required:** ① live-key precheck SERVER-ENFORCED (setStripeMode('live')
    → `live_key_missing` if OE_STRIPE_SECRET_KEY_LIVE unset) + shown in UI; ② typed-confirm
    (must type「正式」before the switch button enables); ③ pending-booking warning + a
    **always-on mode badge in the shell header** (● 测试模式 Sandbox / ● 正式模式 Live on every
    sub-page). Mode switch is AUDITED (`oe_set_stripe_mode` {from,to}); server reads
    stripe_payment_mode at booking time so a flip takes effect on the next order. Free allowance:
    **global default** now admin-configurable (oe fn `resolveContext` reads default_free_tickets/
    seats for new sub-accounts, was hardcoded 1/2) + **per-subaccount overrides** (list existing +
    edit). Front `Settings.tsx` (Stripe card + charge settings + free-allowance) + shell badge;
    App.tsx rewired; oe fn redeployed. **Verified live** (owner session): getSettings
    (liveKeyConfigured=true, pending=0); safeguard-2 button disabled until「正式」typed
    (did NOT flip — live key IS set, would enable real charges); invalid_mode guard; sandbox
    write+audit ok; **lunch price 39.99→55 propagated to customer pricing** (oe resolveContext
    lunchPrice=55) then restored; 8 sub-account overrides listed + one saved; badge shows on
    every admin page; tsc clean. Owner does the real live-flip when ready (like the P5 pay test).
    - **Stripe architecture (owner clarification 2026-07-22 — refactored `_shared/stripe.ts`):**
      test/live KEYS are **platform-level, shared by ALL tools** (one Stripe account, set once).
      Each TOOL has its OWN independent mode switch — OE's is `oe_settings.stripe_payment_mode` —
      so OE can be LIVE while a future tool is TEST; flipping one NEVER touches another. New
      tool-neutral helpers `platformStripeSecret(mode)` / `platformWebhookSecret(mode)` /
      `platformLiveKeyConfigured()` read platform names `STRIPE_SECRET_KEY_{TEST,LIVE}` with
      **fallback to the legacy `OE_STRIPE_SECRET_KEY_*`** (current setup keeps working; owner can
      add platform-named secrets later, and a future tool reuses them). `resolveOeStripe` = OE's
      mode → platform key. **Verified: liveKeyConfigured still true via fallback; mode still
      sandbox; guards intact; oe + admin + webhook fns redeployed.**
  - [x] **P7d — Clean test data (DONE 2026-07-22).** Added `deleteBookingHard` (permanent,
    frees seats, audited) + `deleteSubaccountSettings` admin actions + UI ("永久删除" button in
    the booking detail w/ confirm; delete on each settings sub-account row). Owner confirmed the
    exact list, then hard-deleted the **7 test bookings** (incl. the P5 pay-test BK-1QUH,
    cascades booked_seats) + **7 test sub-account rows**, **KEEPING the real client
    "Ong pei shirl"** (qRI68jTZHoSutcigyIhn). **Verified:** Overview → 0 bookings / 0 confirmed
    / 0 pending / 0 claimed seats / RM 0.00, with the 3 seed events + 1 hall intact; only
    "Ong pei shirl" remains in sub-account settings. Clean slate for launch. tsc clean.
- [x] **P8 — Admin: floor-plan visual editor (DONE 2026-07-22).** admin fn:
  `listFloorPlans` (+ per-plan used-by events + booked-seat count), `saveFloorPlan`
  (create/update; recomputes `physical_seats` = enabled-seat count; **booked-seat
  protection**), `deleteFloorPlan` (blocked if default or in-use), `setDefaultFloorPlan`
  (partial unique index → one default), `duplicateFloorPlan`. All audited. Front
  `FloorPlans.tsx` list (new blank / duplicate / edit / set-default / delete) +
  `FloorPlanEditor.tsx` (grid: click cell→add table, click table→config popover with
  label + shape 2/4/6 + per-seat disable/enable + remove; columns/rows; stage/door;
  **live SeatMap preview** reusing the customer component). Replaces the OEFloorPlans
  placeholder; sections.tsx deleted (all sub-pages now real); App.tsx rewired. Linking a
  plan to an event stays in the P7b event editor (floor-plan dropdown). **Precise booked-seat
  protection (owner-approved):** on save, every seat currently booked on any event using the
  plan must still be ENABLED; else 409 `booked_seats_removed` + a `missing:[{seat,event}]`
  list (surfaced via callOeAdmin `.detail`); unbooked edits are free. Guarantees
  physical_seats ≥ claimed. **Verified live** (owner session, API + UI): default-delete
  guard (is_default); duplicate copies 91 seats; created temp plan+event+booking, disabling
  the booked "G1 Seat 1" → blocked with the exact seat+event, disabling an unbooked seat →
  allowed; then temp booking/event/plan cleaned (back to 1 plan). UI: list shows QAI Hall
  (28 桌·91 座·3 活动); editor renders 28-table grid + controls + 91-seat live preview +
  table config panel (label/shape/seat-toggle/remove); tsc clean; no console errors.
  - [x] **P8b — Adjustable door/stage/divider position (DONE 2026-07-22, owner ask).**
    Owner wanted freer venue elements (not just on/off). Chose the **middle option** (not a
    full free-drag canvas — that stays for the design pass). Extended `layout`: `door`
    (none/bottom-right/bottom-center/bottom-left/top), `stagePosition` (top/bottom), `divider`
    ({enabled, axis vertical/horizontal, pos 0-100%}). Updated offlineEvent.ts normalizeLayout
    (+ types, backward-compat), the shared **SeatMap** (renders stage top/bottom, door at any
    of the 5 positions, configurable dashed divider — legacy auto-75%-with-long-table kept when
    unconfigured; also FIXED a latent gap where the stage always showed regardless of the
    toggle — now honours `stage`), FloorPlanEditor (door/stage-pos selects + divider on/off +
    axis + position slider, live preview), and normalizeLayoutServer (admin fn preserves the
    new fields). Props threaded to SeatMap from EventsPage (customer) + AdminSeatPicker + editor.
    **Verified live:** config round-trips through save (door=bottom-left, stage=bottom,
    divider vertical@60%); customer /events seat map still renders (91 seats, stage, entrance,
    legend) + seat click selects (backward-compat OK); editor shows the new controls +
    enabling the divider live-adds the dashed line; tsc clean; no console errors. Solid "wall"
    bar stays fixed (moving it = the deferred free-drag rewrite).
  - [x] **P8c — Door position slider (DONE 2026-07-22, owner refinement).** Owner wanted the
    door to slide along its edge (not 5 fixed spots). Reworked `door` from the P8b 5-value enum
    to **edge (`none`/`bottom`/`top`) + `doorPos` 0-100% slider** (same UX as the divider). SeatMap
    renders the door pill positioned at `doorPos%` on the chosen edge. `normalizeLayout` (client)
    + `normalizeLayoutServer` (admin) **map legacy bottom-left/center/right/top → edge + %** (15/50/85,
    back-compat); `normalizeLayout` now exported + used by the editor on load so the seeded hall's
    `bottom-right` shows correctly. Editor: 门 select (无/底边/顶边) + position slider. Props threaded
    (EventsPage, AdminSeatPicker, editor). **Verified live:** door round-trips (bottom@30%); legacy
    `bottom-right`→bottom/85; editor slider live-moves the door pill (15%→70%); customer /events seat
    map intact (91 seats, door@85%, seat-select works, no errors); tsc clean.
  - **Webhook RECONNECTED (owner enabling it 2026-07-22).** The `oe-stripe-webhook` fn was
    already code-complete (signature-verified confirm/expire, idempotent) — just dormant (no secret,
    no Stripe endpoint). Redeployed; config.toml comment updated to the platform secret names. It
    reads `platformWebhookSecret(mode)` = `STRIPE_WEBHOOK_SECRET_{TEST,LIVE}` (OE_ fallback). **Owner
    action to activate:** (1) set `STRIPE_WEBHOOK_SECRET_TEST` + `STRIPE_WEBHOOK_SECRET_LIVE` in
    Supabase secrets; (2) in Stripe (TEST + LIVE dashboards separately) add a webhook endpoint →
    `https://hkqzzfyigmvisaftdmwh.supabase.co/functions/v1/oe-stripe-webhook`, events
    `checkout.session.completed` + `checkout.session.expired`. Complements (doesn't replace) the
    return-page verify — both idempotent, whichever fires first wins.
- [x] **P9 — Customer-flow polish (DONE 2026-07-23).** Stepped booking flow (seats →
  lunch → summary) instead of one long page; customer navbar rebuilt (Help Center +
  Tools dropdown, 线下活动报名 later promoted to the main menu); "back to events" on the
  success ticket; bookings list shows location_id + lunch columns; settings gained the
  look-up-any-sub-account-by-location_id panel (SUPERSEDED 07-28 by the F manager below);
  per-sub-account default landing page + `/help` fallback; isolated port-5185 dev config.

## 2026-07-23 → 07-28: platform work + P9 (57 commits, all on this branch)

This branch became the **trunk for all five tools** — `feat/helpdesk` and
`feat/copywriter` were dev-merged in (3d3c68a, 7a13958), so everything below ships
together when this merges to `main`. `main` is ~119 commits behind and is what
playbook.qiai.tech still serves.

- **Layout + navbar fixes (07-24).** Real sticky footer at any window size; guides page
  widened; booking page natural height; the confirm bar only appears once a seat is
  picked and never covers the footer; navbar collapses to a hamburger at `lg` so items
  never crush-wrap; 小工具/指南 moved into the left nav row; 指南 dropdown links to the
  full pages.
- **Q.Ai Brutalist rebrand (07-24 → 07-27, batches 1 → 3.6).** Owner-approved full
  re-skin coral-glass → yellow/black/white. Sample first at `/qai-style` (427a52b), then
  the shared skin (batch 1), presentational pages (2), Helpdesk (3.1), ticket surfaces
  (3.2), Admin Portal (3.3 + 3.3b flattening status colours — owner: 彻底一致), Review
  Boost + /scan (3.4), the customer booking flow (3.5), and the SeatMap (3.6). All
  style-only — no behaviour change in any batch.
- **Helpdesk video AI (07-27, phases 1/2/4).** `hd_video_steps` cache table; video-steps
  preprocessing in `helpdesk-admin` (WaveSpeed → gemini-3-flash-preview); Angel AI now
  answers from inside video tutorials. Batch size 2–3 — 5 hits the 150s edge limit;
  re-runs skip already-converted videos. Real cost ≈ 2¢/video.
- **Pre-launch rate limiting (07-27, steps 1 → 5b).** Shared limiter built on
  `tool_usage` (step 1), then applied to `helpdesk-chat` (2), copywriter copy+voice (3),
  Review Boost incl. closing the regenerate hole (4), and event booking + checkout
  (5) with a per-location backstop (5b).
- **Access model (07-27).** Canary/whitelist rollout mode, flipped from the Admin Portal
  with no redeploy (645c37d); then per-tool access collapsed into **ONE `playbook`
  master switch** (a640a20) — the older per-tool keys stayed in the table but stopped
  being consulted. That dormancy became a trap; see the 07-28 cleanup below.
- **Fixes (07-28).** Stripe mode badge showed Sandbox while actually LIVE — made
  authoritative by resolving the mode the same way the charge does, and it now shows the
  key prefix (d940aa1). Every native browser dialog replaced with in-app `ConfirmDialog`
  (90efc4b, b14634c) — a suppressed `window.confirm()` returns false, which is the real
  cause of the long-standing "点了没反应" reports. Helpdesk gained an AI answer-language
  switch + WhatsApp button, and one-click "sync all" for Notion.

### Launch prep (2026-07-28)

- [x] **Free allowance zeroed across the board (cda1e62).** The allowance table is
  SPARSE — a sub-account with no row inherits the global default on first visit, so
  clearing the 6 existing rows would still have handed the other ~909 the old 1票/2座.
  Migration `20260728120000` writes an explicit **0/0 row for all 911 sub-accounts**
  (909 inserts + 2 updates), zeroes 4 leftover test-id rows, and only then drops the
  global default to **1票/1座** — all in ONE transaction, so no customer can slip
  through between the two steps. Verified: 915 rows, 0 non-zero, 0 locations without a
  row. The test account `gsRRLb2A8IoATd9qWNmh` (AJ | QiAi Demo🔥) was then given back
  1票/2座 so the FREE booking path stays testable.
- [x] **Dormant per-tool access rows cleared (1acf7dc).** ⚠️ **The lesson worth keeping:**
  when the per-tool keys were parked (a640a20) their rows were left in the table, asleep.
  Re-activating `offline_event` would have silently applied year-old test toggles to real
  customers — a full scan found `offline_event = false` on the real client **Ong pei
  shirl**, which would have blocked their booking with no visible cause. New admin action
  `listAccessOverrides` makes every explicit row visible; migration `20260728140000`
  dropped every non-`playbook` row. **Always scan for sleeping data before re-activating
  a dormant feature.**
- [x] **E — per-customer offline-class switch (38f1cc7).** `hasOfflineEventAccess` =
  master Playbook switch **AND** a per-customer opt-out (`no row` → allowed;
  `enabled=false` → blocked). Opt-out, not whitelist: canary already decides who is in
  the rollout, so a second whitelist would mean toggling all 911 twice. Reads fail OPEN;
  admins always pass. All 7 gates in the `oe` fn now use it.
- [x] **F — sub-account manager (58d2587).** Settings page now lists **all 911**
  sub-accounts (driven off `ghl_locations`, not the sparse allowance table), 50/page,
  server-side search across name + location_id, GHL sync, per-row allowance + 回到默认,
  the offline-class toggle, and a read-only "Playbook 已关" badge. Fixed a silent bug on
  the way: the old one-shot name lookup joined every id in one `.in()` and started
  414-ing once the allowance table grew — every business name had gone `null`.
  **Verification method worth reusing:** test customer-facing behaviour with an
  ANONYMOUS request. An admin session bypasses every gate by design, so admin-side
  testing cannot see what a customer sees. Proven this way: switch off → `/events`
  shows "活动报名暂未对你的账号开放" while `/help` for the SAME customer still works.

- [x] **I — one launch switch + ONE copy of the access rule (bfc0369).** Owner asked to
  drop "灰度模式" for a single 「全部开启」 button. **The mechanism was already right and
  was kept** — a flippable global flag is the only thing satisfying all three
  requirements at once: (1) only the test account today, (2) everyone after one click,
  (3) sub-accounts synced LATER usable by default. A default-deny master switch fails
  (3) — every future customer would need opening by hand — and bulk-writing 911 `true`
  rows fails it too, since a later sync still has no row and the global default still
  has to decide. So: rename what the owner sees, collapse the duplication.
  **The rule now lives once**, in `_shared/access.ts` `playbookAllowed(row, whitelistMode)`:
  *no row* → whitelist denies / normal allows; *row* → the row wins **in both modes**.
  That second half is what makes 全部开启 safe — it never resurrects a customer who was
  deliberately switched off. It had been re-implemented in THREE places (customer gate,
  `adminApi.isPlaybookEnabled`, the OE sub-account manager); both servers now call the
  helper and **ship the computed answer**, and the client copy is deleted, so the admin
  toggle can't disagree with reality. (Drift there is invisible to an admin — admins
  bypass the gate.) UI = two states, one button: black 内测中 +「全部开启」(in-app confirm,
  no typed phrase since it reverses in one click) / white 已全面开放 +「改回内测」. New
  `listPlaybookRoster` names who is whitelisted and who is separately switched off.
  **Stored key stays `canary_mode`** — renaming needs a migration and any instant where
  the flag reads absent fails OPEN, which pre-launch would admit all 911 at once.
  Redeployed every fn that bundles `access.ts` (oe, rb, helpdesk, helpdesk-chat,
  generate-copy/voice/review, admin, offline-event-admin) so one rule really is one rule.

  Verified ANONYMOUSLY across all three states, incl. a location_id with no row anywhere
  standing in for a future GHL sync:

  | | 内测中 | 全部开启 | 改回内测 |
  |---|---|---|---|
  | test account | on | on | on |
  | no-row customer | off | **ON** | off |
  | simulated new sync | off | **ON** | off |
  | deliberately switched off | off | **off** | off |

### Current access state (2026-07-28) — pre-launch step ② is DONE

Rollout flag is **内测中** (`canary_mode.enabled = true`, i.e. whitelist).
`location_tool_access` holds exactly:

| location | key | value | effect |
|---|---|---|---|
| `gsRRLb2A8IoATd9qWNmh` (AJ QiAi Demo🔥) | `playbook` | true | the only account real customers can use |
| `gsRRLb2A8IoATd9qWNmh` | `offline_event` | true | offline classes allowed |
| `qRI68jTZHoSutcigyIhn` (Ong pei shirl) | `playbook` | false | closed until full launch (owner's call) |

Everyone else has no row → canary denies. Verified anonymously: test account
`enabled: true`, Ong pei shirl `false`, a normal customer `false`.

#### `CANARY_FALLBACK` — the switch that decides what an unreadable flag means (2026-07-29)

`isCanaryMode` used to fail OPEN in three separate ways, all silent: a query error
(the `error` was never destructured, and supabase-js RETURNS it rather than throwing,
so the `catch` never fired), a missing `canary_mode` row, and a `value` whose shape
changed. Each looked identical to "flag is off" → default-allow → **cached for the
full 20s TTL, with no log line**. Nobody ever reports being let in when they should
not have been, so this class of bug has no reporter.

Now all three read `CANARY_FALLBACK` from the environment (not the DB — the DB is the
thing that just failed; `Deno.env` answers on a cold isolate with no failure mode of
its own). A "reuse the last good value" cache was rejected: a cold isolate has no last
good value, and at pre-launch traffic almost every request is cold.

| value | meaning when the flag can't be read |
|---|---|
| `deny` (default when unset) | whitelist mode — only an explicit `enabled=true` row gets in |
| `allow` | normal mode (the old behaviour) |

**Cost of `deny` today: zero.** `isCanaryMode` is only consulted when a sub-account has
NO `location_tool_access` row (`access.ts`, the `stored === null` branch).
`gsRRLb2A8IoATd9qWNmh` has an explicit `playbook=true` row, so it never reaches it.

> ### ⚠️ Edge Function secrets are injected AT DEPLOY TIME
>
> Setting or changing `CANARY_FALLBACK` in Supabase → Edge Functions → Secrets does
> **nothing** until every function that imports `_shared/access.ts` is redeployed —
> at minimum `oe` and `offline-event-admin`.
>
> **This applies twice:** once now (setting it to `deny`), and again on the day the
> Playbook opens to everyone (flipping it to `allow`). Forgetting the flip refuses
> some sub-accounts and someone complains within the hour — loud and fixable in one
> deploy, which is the whole point of choosing `deny` as the default.

### ⚠️ Vercel env vars are PER-ENVIRONMENT — check before merging (2026-07-28)

**What happened:** the owner found Vercel showing "No Environment Variables Added".
Confirmed against the LIVE production bundle
(`playbook.qiai.tech/assets/index-*.js`): it contains the *error message* strings
`SUPABASE_URL` / `SUPABASE_ANON_KEY` but **no `https://….supabase.co` and no `eyJ…`
anon key** — Vite inlines `import.meta.env.VITE_*` at build time, so their absence
proves the build had no values. Root cause: the vars existed only on
**Production**, not Preview/Development.

**Why nobody noticed:** the pages customers actually visit on the old `main`
(home, DFY, credits, upgrade, affiliate, guides) never call Supabase, and the
copywriter entry is hidden. The mine was buried, not defused. Every one of the
five tools on this branch needs Supabase, so **merging to `main` without the vars
set would have broken the whole site for customers.**

**Why `/help` looked fine while Offline Event errored** — NOT different env
reading (both go through the same `getSupabase()`): `helpdesk.ts checkHelpAccess`
wraps the call in try/catch and fails OPEN, so it rendered an empty shell instead
of an error. Offline Event surfaced it honestly. A tool that "works" can still be
completely disconnected.

**The complete list (only two, both build-time, all three environments):**

| var | value | Production | Preview | Development |
|---|---|---|---|---|
| `VITE_SUPABASE_URL` | `https://hkqzzfyigmvisaftdmwh.supabase.co` | ✅ | ✅ | ✅ |
| `VITE_SUPABASE_ANON_KEY` | the anon *public* key | ✅ | ✅ | ✅ |

Never add a `service_role` key as a `VITE_` var — it would be inlined into
browser code. Every other secret (Stripe `sk_`, Anthropic, WaveSpeed, MiniMax,
Notion, GHL) belongs in Supabase Edge secrets, NOT Vercel. Vite inlines at build
time, so **changing a var requires a redeploy** to take effect.

**Owner fixed it 2026-07-28** (added to all three environments, redeployed,
preview then read data correctly). **Pre-merge check: confirm Production has every
var the build needs.** Security scan run at the same time: no `sk_live_`,
`sk-ant-`, `service_role`, WaveSpeed/MiniMax/Notion keys anywhere in `src/`,
`index.html`, the shipped bundle, or the full git history; `.env` is gitignored
and has never been committed (only the placeholder `.env.example`).

## Pre-launch rebuild rounds (2026-07-28) — batches 0–8

State that lived only in the working conversation is recorded here so a new
session can resume without re-deriving it.

### ⚠️ Standing ops reminder (do this every time, not once)

**After changing the seat price, the lunch price or the SST rate in the admin,
check the NEXT order's edge-function log** (Supabase → Functions → `oe` → Logs)
for `itemised cent mismatch`. The Stripe summary silently falls back to the old
lumped two-line layout when the per-line cents don't add up to the order total;
the charge stays correct, so nothing else will ever tell you. A quicker read of
the same signal: the Stripe page shows ONE "活动名 — N seat(s)" line instead of
separate ticket / lunch / SST lines.

### 🟢 TEST DATA IS GONE (2026-07-29) — the baseline below is historical

`oe_bookings` and `oe_booked_seats` are **empty**. All 24 test bookings and their
3 seats were deleted after the owner reviewed a row-by-row export. Full evidence
and execution log: [`docs/cleanup/2026-07-29-oe-bookings-preclean.md`](docs/cleanup/2026-07-29-oe-bookings-preclean.md).

**Done as CLI SQL (`supabase db query --linked`), NOT through the admin UI — so
`admin_audit_log` has no entry for it.** The export file committed beforehand is
the record, and it holds more than an audit row would: the contents of what was
removed, not just the fact.

**Why no bulk-clear button was added.** 17 of the 24 were tier A (payment traces),
and `ArchiveModal` refuses a bulk permanent-delete containing *any* tier-A row on
purpose — a batch that carries one through is a way around the gate, which is the
entire reason the gate exists. The options were: type 17 booking codes by hand, or
add a one-time bypass. Both were rejected. A "one-time" bypass in a codebase about
to merge to `main` is permanent, and it would weaken a money-safety gate the week
of launch to save ten minutes. **The tier-A gate is untouched by this cleanup.**

Also settled here, and it is the general rule: the gate protects *real* money.
`stripe_payment_mode` was `sandbox`, so every payment trace in those 24 rows was a
Stripe test record — the gate was guarding nothing in this particular case. That
reasoning does **not** transfer to live mode.

Two counts corrected in the process, both by running the real predicate instead of
reading the rows by eye:
- **17 tier A, not 15.** `BK-XQOU-YSTLLS` had no Stripe reference at all but
  `total = 500.00`, and `hasPaymentTrace` is true on the amount alone.
- **`BK-JE8N-4TX8W2` was tier B, not tier A.** The only `confirmed` row and the
  holder of all 3 seats, but `total = 0.00` with no Stripe references — provably
  money-free, so `blocksArchive` was false and it was archivable all along.

**Consequence to be aware of:** `freeSeatsUsedFor` is derived, so wiping the
bookings reset consumption to 0. The test sub-account `gsRRLb2A8IoATd9qWNmh` went
from 1 free seat remaining to **4** (its own row is `free_tickets=2, free_seats=4`).
Left as-is — owner's call, and it is the internal test account.

**Global defaults are now `0/0`** (`default_free_tickets`, `default_free_seats`,
set 2026-07-29 before the wipe). A new sub-account inherits nothing. Owner's rule:
payment runs through his own Stripe, so one free seat is RM 397 not collected —
giving a free ticket must be a deliberate admin action, never inheritance.

### Test-data baseline (historical — see above, this data no longer exists)

| Thing | Value | Note |
|---|---|---|
| Test sub-account `gsRRLb2A8IoATd9qWNmh` | `free_tickets=2`, `free_seats=4` | Read 2026-07-28T09:17:53Z. **The restore target for batch 7.** The owner changed this during GHL testing — do not assume 1/2. During batch 5.5 it was temporarily `free_tickets=1`, `free_seats=2`; `free_seats` is being restored to 4. Only `free_seats` affects charging — see the 票/座 traps in the batch 8 backlog. |
| Global defaults | `default_free_tickets=1`, `default_free_seats=1` | Re-verified by SQL 2026-07-29; both rows written 2026-07-28 04:11:29 by the allowance reset. This line was briefly "corrected" to "the rows do not exist" — that was wrong, see below. |
| `oe_settings.sst_rate` | `0.08` | Stored as a STRING decimal → `Number(x)*100` for display, and skip the label when 0. |
| `oe_settings.lunch_price` | `39.99` | |

#### The seven free-allowance fallbacks, and a retracted "correction" (2026-07-29)

**Verified by SQL against the live database:**

```
default_free_seats     = "1"   updated_at 2026-07-28 04:11:29+00
default_free_tickets   = "1"   updated_at 2026-07-28 04:11:29+00
```

Both rows exist. The `1/1` originally recorded in the table above was **correct**.

> **Retracted.** A note here briefly claimed the two rows did not exist — read off
> the Supabase Table Editor — and built a whole story on it: that the live values
> were really `1/2`, that every sub-account since P7c had inherited two free seats,
> and that two admin pages were showing different numbers. **All of that was
> false.** A stored value always won, so all three surfaces read `1/1` and always
> agreed. The lesson that survives is a smaller one, and it is about method: a
> Table Editor glance is not a verification. `supabase db query --linked` is.

What was real: the **seven code fallbacks** for these two keys held five different
opinions — `1, 2, 2, "1", "2", 1, 1`. Harmless while the rows exist, and a trap the
day one is deleted, since the three surfaces would then diverge silently.

| # | location | was | now |
|---|---|---|---|
| 1–2 | `oe/index.ts` `loadSettings` | `1`, `2` | `0` |
| 3 | `oe/index.ts` `createBooking` — `sa?.free_seats ?? 2` | `2` | `0` |
| 4–5 | `offline-event-admin/index.ts` `getSettings` | `"1"`, `"2"` | `"0"` |
| 6–7 | `offline-event-admin/index.ts` `listSubaccountSettings` `defaults` | `1`, `1` | `0` |

Zero is the right answer to "no configuration": a sub-account that should get free
seats is one `oe_subaccount_settings` row away, and that row records the decision.
**If an eighth surface ever needs this number it reads one of these — it does not
add another `??`.**

> ### ✅ CLOSED 2026-07-29: a new sub-account now inherits nothing
>
> Commit B changed only the fallbacks; `resolveContext` reads the **stored**
> default, which was `1`. Both `oe_settings` rows were therefore set to `0` (owner
> approved with the numbers in hand), read back to confirm, immediately before the
> test-data wipe — that order matters, since the wipe resets consumption and a
> non-zero default would have left a fresh free seat waiting in between.
>
> The 910 existing `0/0` rows were never affected either way.
>
> Owner's rule, recorded because it governs future changes here: payment runs
> through his own Stripe, so **one free seat = RM 397 not collected**. Granting a
> free ticket is a deliberate admin action, never something a sub-account inherits
> by existing.
>
> **The demo account went to 0/0 too (2026-07-29).** `gsRRLb2A8IoATd9qWNmh`
> (AJ | QiAi Demo🔥) was `free_tickets=2, free_seats=4` and is the account the
> owner demos to clients with after launch — leaving it meant the first four
> people in a demo walking off with RM 397 tickets. Set to `0/0`; the row still
> exists, so `oe_subaccount_settings` is **still 911 rows**, now 911 of 911 at
> zero. Verified: `resolveContext` returns `freeTickets 0, freeSeats 0,
> freeSeatsRemaining 0`.

#### Lesson: think in windows, not just in end states

Setting the global default to 0 **before** the booking wipe was not cosmetic
ordering. The wipe resets `freeSeatsUsedFor` to zero; had the default still been
`1`, any sub-account arriving in the gap between the two steps would have found a
fresh free seat waiting. Both end states are fine — the window between them was
not.

Generalise it: when two changes each look safe on their own, ask what is true
**between** them, and order them so the unsafe combination never exists. The same
question applies to the Stripe Live switch and 「放开全体」 (open first and the
window is "everyone can book while payment is still sandbox") and to any future
allowance change paired with a data reset.

**Setting them for real still works, and always did:** `updateSettings` upserts
with `onConflict: "key"` and `oe_settings.key` is the PK, so saving the admin
form INSERTs the missing rows. One caveat — `updateSettings` skips any field that
arrives empty-after-trim, so **clearing an input and saving is a silent no-op**
(the form then reloads and snaps back, showing a "已保存" tick over an unchanged
number). Typing `0` writes normally; `0` is not empty.

**14 test bookings were ARCHIVED, not deleted (correction, 2026-07-29).** The
previous note here said the owner had deleted them; batch 5 found them alive:
`listBookings` reported `archivedCount = 14` (the original 11 + batch 5.5's 3),
and `getEventSeatmap` showed **26 seats still locked**, 23 of them held by those
archived rows. Archiving hides a booking and stops its check-in; it does NOT
release seats or delete anything (that is batch 7a). The free-seat *allowance*
did read as freed, because `freeSeatsUsedFor` excludes archived rows — which is
exactly why the archive looked like a delete from the outside.

> **SEMANTICS CHANGED IN BATCH 7a (2026-07-29).** Archiving now RELEASES the
> seats as well as hiding the booking and blocking its check-in; un-archiving has
> to claim seats again and may have to pick different ones. A booking that took
> money and is not cancelled CANNOT be archived at all — permanently, since batch 7b
> (the credit ledger) was cancelled. Cancel it and refund in Stripe instead.
>
> The pre-7a rule, for reading older notes: 归档 ≠ 删除 ≠ 释放座位 — archiving was
> only hiding, and seats were freed by **取消** or **永久删除** only.

### Test data: CLEARED 2026-07-29 (end of batch 5, re-checked after batch 7a)

`oe_booked_seats` holds **0 rows** — verified across every event (there is only
one, `74753c55`, status live). All **19** booking rows are `status = cancelled`
and **0** are archived; the rows are kept on purpose as history. (16 after batch 5,
plus batch 7a's three: `BK-XP79-B1YWU5`, `BK-XPZS-2IS98O`, `BK-XQOU-YSTLLS`.) The customer seat
map now renders **91 seats, all selectable, 0 disabled** (checked anonymously).

How it was done (kept as the recipe): archive modal → select all → 批量取消归档
(16 back to the main list) → main list → select all → 批量取消订单, which
cancelled **9** bookings and released **25** seats. The other 7 were already
cancelled. 6 of the 9 carried payment records totalling **RM8,063.20** — the
confirmation said so, and cancelling refunds nothing. Permanent delete was NOT
used: the tier-A typed-code gate exists for real paid orders, not for clearing
test data, and a cancel frees the seats just the same while keeping the record.

**→ Batch 7a needs NO backfill logic.** "Archive releases the seat" only applies
to new archives and cannot retroactively free what existing archived rows hold —
but there are no archived rows left holding anything.

Only `BK-OJKF-YH6BFL` was ever destroyed (batch 5, to prove the tier-B delete
path). Historical codes stay listed below for cross-referencing Stripe.

**EVERY booking in `oe_bookings` right now is TEST DATA.** (An earlier note here
claimed the opposite — that anything still present was real. It was wrong, and it
is the kind of wrong that gets real data deleted.) The table below is the state
read 2026-07-29 BEFORE the cleanup above — statuses are now all `cancelled` and
nothing is archived; it is kept for the codes, amounts and seat counts.

**15 archived at the time.** 9 were `confirmed` and held **25 seats** between
them; 6 were already `cancelled` and held none.

| Code | Status | Total | Seats held |
|---|---|---|---|
| `BK-AYZT-Z6Q44Y` | confirmed | RM1715.04 | 4 |
| `BK-8YC1-KNVYK8` | confirmed | RM1715.04 | 4 |
| `BK-P34G-G266QR` | confirmed | RM1887.80 | 4 |
| `BK-M9LE-S4IXQF` | confirmed | RM1030.28 | 4 |
| `BK-NOC3-W5VZTN` | confirmed | RM857.52 | 2 |
| `BK-BNVU-BYX1V5` | confirmed | RM857.52 | 2 |
| `BK-12B0-3WTICC` | confirmed | 免费 | 2 |
| `BK-MHZO-IQQK9J` | confirmed | 免费 | 1 |
| `BK-OKFM-8AE7F8` | confirmed | 免费 | 2 | ← batch 5's own free manual add (G3 Seat 2–3) |
| `BK-FZFO-RWMWEX` | cancelled | RM943.90 | 0 |
| `BK-DVJP-62825Y` | cancelled | RM428.76 | 0 |
| `BK-ASHP-O75KRS` | cancelled | RM428.76 | 0 |
| `BK-O7PA-GESM02` | cancelled | RM428.76 | 0 |
| `BK-A64O-PZM4MN` | cancelled | RM1715.04 | 0 |
| `BK-RNZF-05DQ7M` | cancelled | RM857.52 | 0 |

**1 not archived:** `BK-Q6KW-JQ67GC` — batch 5.5 scenario C, RM428.76. The owner
has since **cancelled** it, so G10 Seat 1–3 are already released and it holds
nothing. It is still test data.

**Deleted:** `BK-OJKF-YH6BFL` — batch 5's other free manual add, removed while
verifying the tier-B delete path end to end. The only row batch 5 destroyed.

So `oe_booked_seats` holds **25 rows**, every one of them behind an archived
`confirmed` test booking. Clearing them means cancelling (or deleting) those 9
bookings — un-archiving alone changes nothing about the seats.

### ⚠️ Ordering trap for a temporary allowance change (used in 5.5; reuse whenever the allowance is nudged for a test)

`freeSeatsUsed` is DERIVED (allowance − consumed), and both the customer figure
and the pricing figure are clamped with `Math.max(0, …)` (`oe/index.ts` :335 and
:254). So an over-spent account can never show a negative number or hand out
extra free seats — **but the clamp hides the overspend instead of fixing it**: a
2-seats-overspent account renders "0 left", identical to "exactly used up". You
cannot see it. Batch 7's ledger starts from this account, so a wrong starting
point would be invisible.

Correct order — do NOT restore the allowance first:
0. MEASURE the real consumption first (`USED` = Σ `free_seats` length over this
   location's `status != 'cancelled' AND is_archived = false` bookings). Never
   assume it is 4: `freeSeatsRemaining = 0` only proves `USED >= 4`, because the
   clamp hides an overspend.
1. run the scenarios that need NO allowance (pure paid, paid + lunch) FIRST,
   while remaining is still 0 — they are naturally pure-paid, and their
   `free_seats` is `[]` so they do not move `USED`. Running them after the raise
   would silently eat the free seat meant for the mixed test.
2. raise `free_seats` to **`USED + 1`** — NOT to 8. `max_seats_per_booking` is 4,
   so a remaining allowance of 4 makes every booking fully free (`total = 0`),
   which never even reaches Stripe: the mixed scenario becomes untestable.
   `USED + 1` leaves exactly one free seat, so a 2-seat booking is 1 free + 1 paid.
3. run the mixed-scenario checkout test immediately after the raise
4. **clear/cancel those test bookings first**, so consumption drops back
   (`freeSeatsUsedFor` only excludes `cancelled` and `is_archived` — an unpaid
   pending booking still consumes)
5. only then restore `free_seats` to 4
6. immediately re-check that `freeSeatsRemaining` is back to 0 AND that `USED`
   equals the step-0 figure

### Design decisions already settled (don't relitigate)

- **`display_label` is DEPRECATED** — a shadow of `title_zh` written ONLY by
  `buildEventRow`. Never edit it directly, never expose it in a form.
- **Ticket name is frozen, date/time are live.** The name is the snapshot
  (`title_zh || display_label`, the fallback because display_label is NOT NULL,
  so a ticket can't print blank); the date/time render from the live event,
  because the customer must be told the day they should actually turn up.
- **Receipt language — DEFERRED to batch 6, NOT built.** The settled shape is:
  Stripe's UI follows the customer (`locale`), but line-item names are FIXED
  bilingual single strings ("付费座位 Paid seats" etc.) with the event name from
  `title_zh`, because a receipt is a financial record and must not change shape
  because someone toggled the language. Batch 5.5 shipped **Chinese-only** names
  and passes no `locale`; the bilingual conversion is a batch 6 item.
- **Itemised Stripe summary + the cent check.** `createCheckout` builds one line
  per real component (paid tickets `unit × qty`, free tickets at 0, lunch, SST
  with the percentage derived from `sstRate`). A 0-amount line IS accepted by
  Stripe when the session total is > 0 — verified 2026-07-29 against the sandbox
  API with a throwaway probe function (`cs_test_…`, expired immediately), so
  nobody needs to test that again. The itemised lines are only used if they add
  up to `Math.round(total * 100)`; otherwise we log and charge the OLD lumped
  shape. At today's prices (397 / 39.99, whole cents) the check can never
  trigger — it exists for a future price with sub-cent decimals (RM33.333/seat:
  `round(3333.3) × 3 ≠ round(9999.9)`). **The fallback is SILENT** — the customer
  just sees the old two-line layout, the total is still right, and nothing
  errors, so no one will notice on their own. See the ops reminder below.
- **Permanent-delete tier A/B uses an inverted test** — tier B (weak confirm) only
  when we can PROVE the booking never touched money; anything else gets tier A.
  `status === 'confirmed'` alone is wrong: a paid-then-cancelled booking reads
  `cancelled` yet did take money.
- **No Stripe `tax_rates`.** SST stays a manual line item using our own
  `sstCents`, because two rounding regimes would eventually differ by a cent and
  `oe_bookings.total` is what `confirmBooking` reconciles against.
- **`fmt12h` exists twice** (client `offlineEventFormat.ts`, server
  `offline-event-admin`). Changing the format means changing BOTH; each has a
  comment pointing at the other.
- **pg_net's functions live in the `net` schema, NOT `extensions`.** The
  extension RECORD is registered under `extensions`, which makes
  `extensions.net.http_post(...)` look like the careful spelling. It isn't: a
  three-part name is DATABASE.SCHEMA.FUNCTION, so Postgres goes looking for a
  database called `extensions` and fails with *"cross-database references are not
  implemented"*. Write **`net.http_post(...)`** — `net` is top-level, so that IS
  fully qualified and does not depend on `search_path`.
  **And note how it surfaced:** the broken migration applied cleanly, because a
  cron job body is just a string until cron runs it. The failure appeared only in
  `cron.job_run_details`, two minutes later, and would have sat there forever.
  → **After ANY change to cron SQL, go back and confirm `status = 'succeeded'` in
  `cron.job_run_details`. "The migration applied" is not "the feature works".**
  That table has **no `jobname` column** — only `jobid`. The query is:
  ```sql
  select j.jobname, d.status, d.return_message, d.start_time
    from cron.job_run_details d
    join cron.job j on j.jobid = d.jobid
   where j.jobname = 'oe-sweep-stale'
   order by d.start_time desc limit 5;
  ```
  `return_message = 'DO'` is the DO block's command tag, i.e. success — not an
  error. **And `succeeded` is NOT proof the sweep ran:** `net.http_post` is
  fire-and-forget, so the row says "the HTTP request was queued", nothing about
  what the function did with it. A Vault/Edge secret mismatch produces a silent
  401 every two minutes while this table keeps reporting `succeeded`. The only
  end-to-end proof is watching a real pending booking clean itself up.
- **Capacity belongs to the FLOOR PLAN, not the event.** Two events sharing one
  plan share one headcount, so shrinking it for a second run silently changes the
  first — which may already be selling. There is no per-event override any more
  (batch 6 removed the capacity box). The way to give two events different numbers
  is to DUPLICATE the plan and bind the copy. The editor warns when a plan has more
  than one event and offers Duplicate; batch 8a added that, but the underlying
  model is unchanged, so keep it in mind whenever a second event appears.
- **"Keep first N seats" recomputes from the layout as OPENED**, never from its own
  output — otherwise applying the same N twice keeps eating the hall, and the
  second click looks like it worked. Same reason it will not re-enable seats that
  were already deliberately disabled (G24-G28 in the default hall).
- **`blocksArchive` exists twice, and has to** (client `offlineEventDelete.ts`,
  server `archiveBooking`). The server cannot trust a disabled button, so it
  re-implements the rule. This project has been bitten by duplicated logic before,
  so both sides carry a comment pointing at the other plus "change one → change
  the other in the SAME commit". If they ever disagree, the weaker one decides —
  which is the whole failure mode.

### Batch progress

**Done + accepted:** 0 (check-in refuses archived) · 1 (structured
start/end_time) · 1.5 (title_zh/title_en) · 2 (structured event form) · 3a
(customer card: real title, generated date, theme tag) · 3b (snapshot fields take
title_zh) · 4 (roomier rows, per-row archive, date filter, orphan sentinel) · 5.5
(itemised Stripe summary + the card's "另加 8% SST" label).

**5.5 — DONE + accepted** (b52f96a itemised Stripe summary, 5c08fdf card hint +
page summary), deployed, all three scenarios verified anonymously. The allowance
change needed for scenario C was done by the OWNER in the Admin Portal — the
agent had no privileged DB path (no service-role key locally, CLI credentials
live in the Windows credential manager, and the CLI has no arbitrary-SQL
subcommand), and a temporary service-role function was deliberately NOT used for
writes: read-only probing is fine, but allowance edits and cancellations have a
UI already.

Verified 2026-07-29 (anonymous, no admin session):
| Scenario | Stripe lines | Σ cents | `oe_bookings.total` |
|---|---|---|---|
| A — 1 paid seat | 门票 397.00 · SST 8% 31.76 | 42876 | 428.76 ✓ |
| B — 2 seats + 2 lunch | 门票 2×397.00 · 午餐 2×39.99 · SST 8% 69.92 | 94390 | 943.90 ✓ |
| C — 2 free + 1 paid | 门票 Qty 1 397.00 · **免费票（额度内） Qty 2 MYR 0.00 each** · SST 8% 31.76 | 42876 | 428.76 ✓ |

All three matched `Math.round(total * 100)` exactly, and the itemised (not
lumped) layout on the Stripe page is itself proof the cent check did not fall
back. **The 0-amount line is confirmed on the REAL checkout path**, not just in
the isolated probe: scenario C's Stripe page rendered `免费票（额度内） Qty 2
MYR 0.00 each`. Nobody needs to re-test whether Stripe accepts it.

Scenario C was run with **3 seats, not 2**: the account had `free_seats = 2`
remaining, so a 2-seat booking would have been fully free (`total = 0`) and would
never have reached Stripe. 3 seats = 2 free + 1 paid gives the same mixed order.
Changing `max_seats_per_booking` to force a mix is the wrong fix — pick a seat
count above the remaining allowance instead.
**Anonymity trap:** the Claude browser pane persists a logged-in Supabase
session in `localStorage` across sessions, so "a fresh browser" is NOT anonymous
— check for the `sb-<ref>-auth-token` key and stash it before any customer-side
verification, or an admin bypass will be mistaken for a working gate.

**5 — DONE, awaiting acceptance** (acf2b80 backend, bf09e1c the gate, 577fde0 the
UI; `offline-event-admin` redeployed). Main list is live-only with multi-select
bulk archive; the archive is a modal behind 「已归档（N）」(shown even at 0) and is
the ONLY place permanent delete exists — the detail modal's delete entry is gone.
`requiresHardDeleteGate` in `src/lib/offlineEventDelete.ts` is the single decision
point (inverted: tier B only when provably money-free AND never attended), unit
tested, and reused by bulk archive's skip test so "did money touch this?" has one
answer. Verified live: no delete entry on the list or detail (no trash icon in the
DOM); bulk archive of 3 rows archived 2 and skipped the payment-traced one with
the toast; bulk delete of all 16 archived rows refused the batch and named the 12
tier-A rows; tier A kept its confirm button disabled for a wrong and a partial
code and enabled it only on an exact match (not executed); tier B showed a plain
confirm and its delete completed (`BK-OJKF-YH6BFL`). Empty state rendered with the
list response stubbed empty in the browser (no data touched) — a live empty
archive needs the 15 remaining rows cleared first.

**7a — DONE, awaiting acceptance** (0cc0739 `blocksArchive`, 4a219c3 the server,
77e1c25 the UI; `offline-event-admin` redeployed). Archiving frees the seats with
the same one-liner `cancelBooking` uses; un-archiving CLAIMS seats first and only
then clears the flag, so a booking whose seats were sold meanwhile stays archived
rather than going live holding nothing. Un-archive opens a seat picker
(`UnarchiveModal`, a shell over `AdminSeatPicker` — `SeatOpModal` is wired to
changeSeats/changeEvent, so only the picker is shared) that pre-selects the
original seats when free and otherwise names the booking holding them;
`getEventSeatmap` gained `bookedBy` (label → holder code) for that. **No backfill
was needed** — the batch 5 cleanup had already emptied `oe_booked_seats`.

**`blocksArchive(b) = hasPaymentTrace(b) && status !== 'cancelled'`** is the single
rule for "may this be archived": per-row button, detail modal and bulk archive all
use it, and the server enforces it too (`archive_blocked_paid`, HTTP 400) because a
disabled button is not a gate. Excluding `cancelled` matters — without it the
normal cleanup path (cancel, then archive away) is blocked for every booking that
ever touched Stripe.

Verified live (test rows `BK-XP79-B1YWU5`, `BK-XPZS-2IS98O`, `BK-XQOU-YSTLLS`, all
cancelled afterwards): archive freed G7 Seat 1 and an anonymous customer saw it
selectable; un-archive with that seat still free pre-selected and re-claimed it;
after another booking took it, un-archive said "G7 Seat 1 已被 BK-XPZS-2IS98O
占用", pre-selected nothing and kept submit disabled until a new seat was picked;
the paid live row's archive button was disabled (wording has since been updated — 7b was cancelled), the API
refused it 400, and after cancelling it archived fine. Bulk archive skipped the 1
paid live row out of 19. Caught while verifying: bulk archive claimed it would free
43 seats when 2 would be — cancelled bookings keep their seat LABELS while holding
nothing, so the count now excludes them.

**To do:**
1. **6** — commit 4 (capacity gate) + commit 5 (the 10-minute notice on the
   payment tab). Commits 1–3 are done.
2. **8** — see its backlog below; it absorbed 7b's real findings.

**~~7b — CANCELLED 2026-07-29 (owner's decision, not an unfinished item).~~**
The credit/allowance ledger will NOT be built. Reason: there are no real
customers yet, so there is nothing to design the "paid, then withdrew" flow
against — its frequency and the right handling are both unknown, and guessing
would bake a guess into the money path. The existing **手动加票** covers the rare
case: the owner issues a ticket by hand. Refunds happen in the Stripe dashboard.
If this starts happening often, revisit it then, with real cases to look at.
Consequences that are now PERMANENT, not temporary:
- there is no in-app refund and no credit anywhere;
- `blocksArchive` keeps refusing to archive a live paid booking — forever, not
  "until 7b". The user-facing wording says what to do instead (cancel, then
  refund in Stripe) rather than naming a batch that will never ship.

**Batch 8 backlog — inherited from the cancelled 7b (these are real defects, the
decision not to build the ledger does not make them go away):**

1. 🔴 **`free_tickets` (票) and `free_seats` (座) are two fully independent
   inputs with NO conversion between them.** `updateSubaccountSettings` writes
   whatever each box says, verbatim (`offline-event-admin/index.ts`), and the
   ONLY field that affects money is `free_seats` — pricing derives the free
   portion from it in `computeBookingPlan`. **The owner hit this live**: setting
   「票」to 1 left 「座」at 2, so the intended "1 free seat left" was actually 2,
   and a 2-seat booking would have been fully free. An admin can believe they
   changed the allowance while having changed only the box that does not matter.
   → Either bind the two with an explicit conversion, or mark 票 as display-only
   AND label on the form which box controls charging.
2. 🔴 **The customer banner "你还有 N 张免费票" prints `freeSeatsRemaining` — a
   SEAT count under a ticket label.** Today `free_tickets:free_seats` happens to
   be 1:2 for the test account, so the mismatch is invisible on screen; the
   moment the two stop being proportional the number the customer reads is simply
   wrong. → Settle one unit (almost certainly seats) and fix the wording with it.
3. 🟠 **Un-archive can silently overspend the free allowance — a gap batch 7a
   opened.** Archiving releases the seats AND the free allowance (`free_seats`
   labels stay on the row, but `freeSeatsUsedFor` excludes archived rows, so
   consumption drops). Un-archive protects only one of the two:
   - seats: `oe_claim_seats` is atomic, a taken seat fails the claim ✅
   - allowance: **nothing checks it.** If someone else consumed the freed
     allowance while the booking sat archived, un-archiving writes the same
     `free_seats` array straight back and the account is over its allowance.
   - `Math.max(0, …)` then renders the overspend as "0 left", identical to
     "exactly used up" — invisible, the same clamp trap as batch 5.5's.
   **Downgraded from 🔴 to 🟠 because 7b was cancelled:** with no automatic
   credit flow, un-archiving is a rare manual act by an admin rather than
   something the system does on its own, so the window is far less likely to be
   hit. The defect is unchanged; only its exposure dropped. Fix by re-checking
   the remaining allowance at un-archive time and either refusing or downgrading
   the excess seats to PAID.

**Batch 6 backlog:**
- **`pg_cron` + `pg_net` are ENABLED (owner, 2026-07-29).** ⚠️ `pg_net` lives in
  the **`extensions`** schema, not `public` — the cron migration must call
  `extensions.net.http_post(...)` by full path. Do not rely on `search_path`:
  `cron.schedule` runs the job outside any session you control, so an unqualified
  `net.http_post` fails at run time, not at migration time (i.e. silently, on a
  schedule, where nobody is watching).
- `stripe.checkout.sessions.expire()` whenever a booking is cancelled or its
  seats are released. **Done for the sweep path in commit 1 of batch 6**; the
  ADMIN cancel path still leaves the session payable for up to ~32 min, so
  "booking cancelled but the money arrived" is still reachable there.
- `createCheckout` should pass Stripe `locale` and switch line-item names to the
  fixed bilingual single strings (the deferred receipt-language decision above).
- 🔴 **Capacity — REVISED 2026-07-29, do NOT do the original version.** The old
  plan was "mark `capacity` deprecated and drop the容量 input from the admin
  form". That would tear out the only overselling defence: `oe_claim_seats`
  enforces `taken + want > capacity → refuse` (migration :189-196). Correct order,
  and it must be this order:
  1. keep the gate, but change what it reads — the floor plan's **enabled seat
     count** instead of the hand-typed `capacity`;
  2. fix the misleading refusal: a seat beyond capacity is rejected and the UI
     says 「所选座位已被占用」 about a visibly empty seat — it must say
     「本场活动名额已满」;
  3. only then may the `capacity` field be retired. Retiring it before step 1
     leaves nothing enforcing capacity at all.

**Batch 8 backlog — capacity vs the floor plan (found 2026-07-29, NOT fixed):**
the seat map renders **91 selectable seats** while the event reports
**`seats_left` 60**, because `oe_events.capacity` is 60 and
`seats_left = capacity − booked` (`oe/index.ts` :374).
**Correction to an earlier note here: capacity IS enforced** — `oe_claim_seats`
refuses a claim when `taken + want > capacity` (migration :189-196), so seat 61
cannot be sold and there is no overselling. The real defect is the mismatch: the
picker offers 31 seats that will be refused at claim time, and the refusal
surfaces as "所选座位已被占用" on a seat that is visibly empty. Decide which is
authoritative (the plan's enabled seats or `capacity`) and make the other follow.

### Batch 8 is split: 8a gates launch, 8b does not

**8a — before launch, one item only:** bulk seat disable in the floor-plan editor.
It is on the critical path because batch 6 commit 4 made the floor plan the ONLY
way to set a seat-selection event's headcount, and today that means clicking seats
one at a time.

**8b — after launch**, in no particular order: the 票/座 unit mismatch (both
items), the `seats_unavailable` error-code split ("seat taken" vs "event full"),
`deleteEvent`'s orphan source, the change-date warning, the `verify_jwt` exposure
review, un-archive overspending the allowance, the phone seat-tap threshold,
shrinking capacity after tickets are sold, and **the SST server-side guard below**.

- 🟠 **(8b) 「你的免费票已用完」 is now wrong for every customer.** With all 911
  sub-accounts at `0/0`, `freeRemaining` is 0 for everyone, so
  `EventsPage.tsx` (the `freeRemaining > 0` ternary) shows **「你的免费票已用完，
  超出部分按活动票价收费」** to a first-time visitor who never had a free ticket
  to use up. Verified anonymously 2026-07-29. It does *not* print the meaningless
  「还有 0 张」 — that case was already handled — but "已用完" asserts a history
  that does not exist.
  → Fix: distinguish "allowance is 0" from "allowance spent". When the sub-account
  was never granted any (`freeSeats === 0`), either drop the banner entirely or say
  something true like 「本活动按票价收费（最多 4 人/单）」. Same for the English
  string. Cosmetic, but it is the first sentence every customer reads.

- 🟠 **(8b) `sst_rate`'s server-side guard is decorative — the UI hides the hole
  rather than closing it.** `updateSettings` refuses a blank `sst_rate` with
  `sst_rate_required`, but it can never fire from the admin page: `Settings.tsx`
  sends `Number(sstPercent) / 100`, so a blank box has already become the number
  `0` by the time the request is built, and `0` is a legitimate tax rate. The UI
  guard added on 2026-07-29 blocks the normal path, so this is not reachable by an
  admin using the page — **but anyone calling the API directly still writes a 0%
  tax rate through a check that looks like it prevents exactly that.**
  → Fix: send the raw string from the form and let the server do the `/100`, so
  "blank" survives the wire and the server can actually tell the two apart. Small,
  but it changes the wire contract for one field, which is why it is not being
  done during launch week.

**Batch 8 backlog — found while verifying batch 6 commit 4:**
- 🟠 **(8b — NOT a launch blocker; owner tested a real phone inside GHL and seat
  selection plus the confirm bar both worked, so the GHL iframe renders at
  desktop width ≥768px and takes the desktop path.) A customer opening the URL
  in a phone browser DIRECTLY still hits this.** Seat taps
  are ignored until the map is zoomed past `CLICK_SCALE_THRESHOLD = 0.6`
  (`SeatMap.tsx`), but the initial scale is `min(1, container / 944)`:
  **0.2394 at a 320px viewport, 0.3072 at 384px** — measured. So on a phone the
  map ALWAYS starts below the threshold and needs 6 (320px) or 4 (384px) zoom-in
  taps, or a pinch, before any seat responds. There is a hint ("双指缩放放大后可
  选座") but the default state is unusable, and this market is phone-first. At
  ≥768px `isMobile` is false, scale is 1 and taps always work — **so the real
  question is how wide the GHL iframe renders**. Owner is testing on a real phone
  inside GHL before this is prioritised.
- 🟠 **Shrinking capacity after tickets are sold is painful.** `saveFloorPlan`
  refuses to disable any seat that is currently booked (`booked_seats_removed`).
  Sensible, but to go from 91 down to 50 after 30 scattered bookings you must
  find 41 seats that nobody holds — with a scattered layout that is fiddly and
  there is no "shrink to N" helper.
- 🔴 **The floor-plan editor has no bulk seat disable — and it is now the ONLY way
  to set a seat-selection event's headcount.** Removing the capacity box (commit 4)
  means "limit this event to 60" went from typing `60` to clicking 31 seats one at
  a time; reducing 91 to 4 in the batch 6 verification would have been ~87 clicks,
  so that was done through the API instead. **This is a real regression introduced
  by commit 4, not a pre-existing annoyance** — the owner raised it as such, and
  the trade was accepted deliberately: one authoritative number beats two numbers
  that disagree, and the disagreement was already producing "所选座位已被占用" on
  visibly empty seats. What batch 8 owes: drag-select / bulk disable in the editor,
  or a "keep only the first N seats" shortcut. The commit-4 change itself stands.

**Batch 8 backlog:** the change-date warning; and `deleteEvent` still permits
deleting an event whose bookings are all cancelled, which orphans them via
`ON DELETE SET NULL` — the sturdier fix is to forbid deleting any event with
bookings at all and archive events instead.

### Launch order (owner's list, REVISED 2026-07-29 — follow the numbers)

1. [x] ~~**Batch 6** — DONE. Commits 1–5 all verified: 10-minute hold with
       retrieve→expire→release, sweepAll behind a shared secret with an overlap
       lock, the 2-minute cron, the capacity source rules, and the pay-within-N
       notice (N read from HOLD_STALE_MINUTES, never a literal).~~
2. [x] ~~**Batch 8a — DONE** (fba501e): 「只启用前 N 个座位」in the floor-plan
       editor, plus the shared-plan warning. Everything else is **8b (after
       launch)** — see the 8a/8b split below.~~
   — ~~**Batch 7b**~~ CANCELLED 2026-07-29; its real findings moved into batch 8.
   — **H** (navbar icons) is deferred to AFTER launch by the owner's decision.
3. [ ] **Clear ALL test data — genuinely delete it.** Every row in `oe_bookings`
       today is test data (19 cancelled + batch 6's own). Archiving is NOT enough
       and cancelling is NOT enough: `oe_bookings` AND `oe_booked_seats` must both
       come out empty. Use the Admin bulk actions (archive → 已归档 modal → bulk
       delete); do NOT type booking codes 19 times — the tier-A typed-code gate
       exists for real paid orders, not for clearing test data. Keep the Notion KB.
4. [ ] **Confirm the Copywriter works before merging** — reachable from the nav,
       and actually functional (not a 404, not a blank screen, not a missing env
       var). It merges to `main` TOGETHER with Offline Event, not in a second pass.
5. [ ] **Merge to `main`** + deploy `playbook.qiai.tech`.
6. [ ] **GHL menu links → the real domain** (still only for the test sub-account).
7. [ ] **Run one complete payment on the real domain, still in TEST mode.**
8. [ ] 🔴 **Stripe Sandbox → Live** — see the checklist below. A step of its own;
       do not fold it into any other cleanup. **Owner confirms with a consultant
       before this runs — do not switch it unprompted.**
9. [ ] **Open it to everyone** + 「全部开启」.
10. [ ] **H** — customer navbar → icons + hover labels. Deferred to after launch.

Still open, slot in where convenient (not gating):
- [ ] **C** — make the Admin Portal 归档 entry obvious (owner archived one item and
      couldn't find it, thought it was broken). Partly addressed by batch 5's
      「已归档（N）」button; re-check with the owner.
- [ ] **G** — customer "设为默认页": show the current default + allow clear/change.
- [ ] **K** — full Notion sync (currently 53/1200) → `planVideoSteps` +
      `runVideoStepsBatch` (batch_size 2–3, never 5 — 150s edge limit; re-runs skip
      already-converted videos).
- [ ] **B (partial)** — the 挂件品牌 placeholder is already gone (6e4aa97); still sweep
      for other 即将上线/TODO placeholders. The copywriter one is INTENTIONAL — leave it.

### 🔴 Stripe Sandbox → Live checklist (step 10; owner runs it with a consultant)

**Do not switch this unprompted.** The owner will confirm with a consultant first.

- [ ] a. All test data cleared (step 5 above) — a Live switch on top of test rows
      means real money reconciling against junk.
- [ ] b. Live keys set in **Supabase Edge secrets only** (`STRIPE_SECRET_KEY_LIVE`,
      `STRIPE_WEBHOOK_SECRET_LIVE`). Never in `.env`, never in the frontend.
- [ ] c. Know exactly what flips: keys are **platform-level** (one Stripe account,
      one test/live pair shared by every tool), but each TOOL has its own mode
      switch. Offline Event's is `oe_settings.stripe_payment_mode`
      (`sandbox` | `live`), read live on every charge by `resolveOeStripe`, and
      changed through the Admin Portal's mode switch (which refuses `live` unless
      the live key is configured, and writes an audit row). Flipping it does not
      touch any other tool.
- [ ] d. Webhook endpoint pointed at Live if one is in use. Note: `oe-stripe-webhook`
      is deployed but DORMANT — the money path today is the return page's
      `confirmBooking` plus `sweepStalePending`, both of which verify against
      Stripe with the secret key. If it stays dormant, say so explicitly rather
      than assuming it covers anything.
- [ ] e. First Live charge is a REAL card on a minimum-amount event (e.g. a
      temporary RM1 event); confirm the money actually arrives.
- [ ] f. Refund that charge in the Stripe dashboard and confirm the refund landed.
      ⚠️ The app has no refund flow AND never will (batch 7b cancelled), so the refund
      happens in Stripe and the booking must be cancelled in the Admin separately.
- [ ] Only after (f) succeeds: open it to everyone (step 11).

## Post-launch to-do (opened 2026-07-29 — everything deferred past the merge)

Ordered by **deadline**, not by size. The 🔴 items have a launch step they must
land before; the rest are dated only by "after".

### 🔴 Before opening to everyone (step 11)

**1. ✅ DONE (2026-08-04) — Root-cause the Copywriter triple retry.**
It was our parser, not the model. `funnel` did arrive as a JSON string, but that
string was well-formed pretty-printed JSON: `sanitizeJsonControlChars` escaped
newline, CR and tab while JSON forbids **all 32** codepoints below U+0020 inside a
string, so the retry parse failed with the identical error and a whole paid
generation was discarded. A second gap alongside it treated any backslash as the
start of a valid escape. Both fixed, with unit verification; `automationMessages`
turned out to have no shape check at all and was silently returning six blank
messages on a 200. The model and prompt are untouched — a Sonnet 5 + `strict: true`
trial measured better on every number but changed the copy's voice, and the owner
kept `claude-sonnet-4-5`. Same questionnaire: 3 of 3 single attempts failed before,
1 of 1 passed after. Full trail in **PROGRESS.md**.

**2. ✅ DONE (2026-08-04) — Re-set the loading copy.** Now「通常 1.5-2 分钟」in all
three languages, from measured runs: 69-85s clean, 81-101s on a detail-rich
questionnaire. The old「1-5 分钟」was written when a retry storm was the norm; with
the coercion fixed, single attempts should succeed far more often, so the ceiling
is no longer representative.

**3. ✅ DONE (2026-08-04) — `CANARY_FALLBACK` flipped to `allow` and redeployed.**
It had become backwards. `canary_mode` is already `false` (all 918 sub-accounts
open), so `deny` no longer protected a closed beta from leaking access — it meant
one failed read of `platform_settings.canary_mode` would fall back to WHITELIST
mode and refuse **all 918 accounts at once**.

Owner set it to `allow` in the dashboard; `oe` and `offline-event-admin` were both
redeployed afterwards, because Edge Function secrets are injected at deploy time
and the dashboard change alone has no effect. Customer path re-checked after the
deploys — `/events?location_id=…` still renders its event, no console errors.

*What is NOT proven, by design:* the fallback is only consulted when that settings
read **fails or returns malformed data** (`access.ts` → `canaryFallback()`), never
on the normal path, so confirming the new value would mean inducing a database
failure in production. Not worth it. If the fallback ever does fire it logs
`isCanaryMode: … using CANARY_FALLBACK` — that line in the Edge logs is the signal
that a settings read broke.

### 🟠 Soon after launch

**4. Verify the refresh-mid-generation race for real.** The notice was proven
with a synthetic marker (72 s → notice + live counter + Generate disabled;
5 min → purged on mount). Driving an actual reload from the test harness did not
reproduce a user refresh — the retry loop kept running across it — so the live
race is unproven. One manual refresh in a normal browser closes this.

**5. The four pre-existing type errors**, if they aren't fixed before the merge:
`FloorPlanEditor.tsx:126,128` (`KeepFirstNSeatsResult` not narrowing),
`AdminSidebar.tsx:41` (`Item.end`), `pdf.ts:269` (`Uint8Array` vs `BlobPart`).
Vite doesn't typecheck, so the build passes regardless — which is why they
survived this long.

**6. End-to-end test of Copywriter recovery through the UI.** The server half is
verified (result stored, recover by requestId returns the full payload, a wrong
requestId returns null, the row carries no `client_key` and the limiter counts 4
not 5). The browser half — refresh, see the notice, poll, collect — has not run
against the deployed function.

### 🟡 Batch 8b backlog (collected here so it is all in one place)

| Item | Note |
|---|---|
| ~~「你的免费票已用完」 is wrong for an account that never had an allowance~~ | ✅ **Verified in production 2026-08-04.** Anonymous load of `/events?location_id=gsRRLb2A8IoATd9qWNmh` (a 0/0 account): the allowance block does not render at all — neither「已用完」nor「还有 0 张」. Checked by walking every text node in `document.body`, not by eye: `免费票` appears exactly once, in the static footer note「选座、价格与免费票额度都由后端核算」, which is not the banner. Event data loaded normally (title, RM 397, 座位充足) so this is a real render, not an error state. Browser pane held no `sb-*` key, so the load was genuinely session-free. **Only the 0/0 state is verified** — "has remaining" and "genuinely exhausted" were not exercised, and both route through the same new three-state branch. Check them opportunistically the next time an account is given an allowance by hand |
| ~~票/座 unit mismatch~~ | ✅ **Customer-facing copy fixed 2026-08-04** (`名额` / `slot`, not `票` / `ticket`). `座位` was rejected: an event with `seat_selection_enabled = false` has no real seats, its labels are synthesized per booking. Five strings in two languages — the file has no Malay branch. **Admin side done 2026-08-05** (`名额` throughout, `free_tickets` gone). |
| 票/座 unit mismatch | Copy says tickets, the number is seats |
| `seats_unavailable` conflates two errors | "that seat is taken" vs "the event is full" |
| ~~`free_tickets` is a write-only field~~ | ✅ **Deprecated 2026-08-05.** Audited: it never touched pricing, validation or the customer UI. Removed from the admin form, from both signatures and from the customer API; the column is kept for 918 rows of history and now defaults to 0. |
| ~~Charge-settings save overwrites the free-allowance defaults~~ | ✅ **Fixed and verified on production 2026-08-05.** `saveCharges` posts only its own three fields, and both `default_free_*` keys are out of the server allow-list so the read-only box is not merely decorative. Proof: **4 consecutive charge saves wrote lunch_price / sst_rate / max_seats_per_booking at 07:43:40 while `default_free_seats` stayed at 07:33:14.** The 2026-07-29 failure was five keys sharing one timestamp; it is now three. |
| ~~`updateSubaccountSettings` took a dead parameter~~ | ✅ **B1 signature shipped and round-tripped 2026-08-05.** Now `(locationId, free_seats)`. Verified both directions on production — 0→1 then 1→0 — audit payloads `{free_seats, location_id}` with no `free_tickets`, and the 0 boundary clamps correctly. |
| `deleteEvent` orphan source | Fix where orphans are created, not just the symptom |
| Change-date warning | Warn that N bookings already exist |
| `verify_jwt = false` exposure review | |
| Un-archive can overspend the allowance | Seats are protected atomically; the allowance is not |
| Phone seat-tap threshold | Direct-URL on a phone browser only; not reproducible inside the GHL iframe |
| Shrinking capacity after tickets sell | `booked_seats_removed` guard makes it awkward |
| SST server guard is decorative | UI blocks the normal path; a direct API call still writes 0% |
| Platform link name should be required | `label` NOT NULL + backfill the existing row |
| H navbar icon change | |

## oe_ table map (old → new; built in P1)
`event_dates`→`oe_events` (+ per-event price) · `floor_plans`→`oe_floor_plans`
(+ physical_seats) · `bookings`→`oe_bookings` (+ status, stripe_session_id) ·
(new) `oe_booked_seats` (atomic seat lock) · `ghl_subaccount_settings`→
`oe_subaccount_settings` (free allowance only; no is_enabled) · `app_settings`→
`oe_settings` · `admin_users`→(dropped, use platform_admins) · email tables→(dropped).
RPC: `try_book_seats`→`oe_claim_seats` (seat-level atomic).

## Rules carried over (same as RB/Admin Portal/Helpdesk)
- **Customer-side verification must be ANONYMOUS, and prove it BEFORE you start,
  not after.** An admin session passes every gate by design, so an admin browser
  shows a working page even when real customers are blocked. The trap: the Claude
  browser pane keeps a logged-in Supabase session in `localStorage`
  (`sb-<project-ref>-auth-token`) ACROSS sessions — a freshly opened pane or a new
  tab is NOT incognito. So the first step of any customer-side check is to read
  that key; if it exists, stash it under a temp key, verify, then put it back
  untouched (never read or print the token itself). Batch 5.5 learned this the
  expensive way: one scenario ran with the owner's session live and had to be
  re-run, leaving a stray test booking behind.
- **`EventsPage.tsx`: `const` declaration ORDER is load-bearing, and `tsc` will not
  save you.** One `const` reading another that is declared further down is a
  temporal-dead-zone `ReferenceError` at RENDER time — the whole `EventBooking`
  component blanks out, and `npx tsc --noEmit` reports nothing. Batch 6 hit this
  twice in one session (the measured bar height reading `seatCount`; `holdMinutes`
  reading the `payHoldMinutes` state). **A clean typecheck is not evidence this
  file renders. Open the page in a browser before committing a change to it.**
- **Never inspect a pending booking with `getEvent` — it sweeps.** `getEvent`,
  `createBooking` and `createCheckout` all call `sweepStalePending` on the way in,
  so merely *looking* at a ripe pending booking through the customer API consumes
  the test case you were about to use. Read it with the ADMIN
  `getEventSeatmap` / `listBookings` (neither sweeps) or the customer
  `getBooking` (also safe).
- **To test anything about PENDING bookings, burn the free allowance first.**
  `max_seats_per_booking` and the test account's `free_seats` are both **4**, so
  while the allowance is untouched every booking comes out fully free →
  `total = 0` → no Stripe session → **no pending row exists to test with**. Make
  one free booking that eats the allowance down (e.g. 3 seats), then book again:
  that one is part-paid and lands as `pending` with a live session. Batches 5.5
  and 6 both walked into this; there is no need for a third time.
- Commit + push after every phase (owner lost unpushed work once).
- DB: dry-run then apply; only ADD oe_ tables; never touch other tools' tables.
- Backend keys (Stripe, GHL, Anthropic) only in Supabase Edge secrets (owner sets).
- Owner is non-technical: explain in Chinese, step by step, surface pros/cons for
  decisions, plan → confirm → build → verify in dev → commit+push.
- AI (Claude) is basically unused here (booking system) unless an obvious use appears.

## `free_tickets` does nothing — audit 2026-08-04

`oe_subaccount_settings.free_tickets` and `oe_settings.default_free_tickets` are
**write-only**. Traced every reference:

- **Pricing and booking validation read `free_seats` ONLY** (`oe/index.ts` →
  `priceQuote`): `.select("free_seats")`, `freeAllot = sa?.free_seats ?? 0`,
  `freeUsedNow = min(seatCount, freeRemaining)`, `paidSeats = seatCount -
  freeUsedNow`. Usage is counted by `freeSeatsUsedFor()`, which sums
  `oe_bookings.free_seats`. `free_tickets` enters no arithmetic anywhere.
- **The customer never sees it.** `resolveContext` returns `freeTickets` in the
  context object, but `grep "\.freeTickets" src/` is **zero hits** — the field is
  declared in the client type and never read. Every customer string interpolates
  `freeSeatsRemaining`.
- **The only thing it does is render in the admin UI**, `Settings.tsx` →
  「全局默认（N 票 / N 座）」, describing an allowance that does not exist.

So it is worse than `display_label` was: that at least displayed something real.
An admin who types "票 = 5" believes they granted five free tickets and granted
nothing. Fixing only the wording would hide the control instead of removing it.

**Decision: option B** — drop it from the admin form, keep the column marked
deprecated, same treatment `display_label` got. Explicitly NOT option C
(make tickets and seats interact): the system has no "ticket" entity at all, only
seats, so a conversion rule would be inventing a concept to justify a field.

### 🔴 Found while auditing: 7 accounts will each get a free seat

**Do not read a migration file as the current state of the database.** The
2026-07-29 cleanup zeroed the per-account rows but not the global defaults, and the
migration's own comments describe intent, not what is stored now. Queried live via
`supabase db query --linked`:

| | |
|---|---|
| `oe_settings.default_free_tickets` | **`1`** (updated 2026-07-29 09:17) |
| `oe_settings.default_free_seats` | **`1`** (same timestamp) |
| `oe_subaccount_settings` rows | 911, **all 0/0** — the cleanup did work here |
| `ghl_locations` | 918 |
| **Locations with NO settings row** | **7** |

Those 7 have no row, so the first time each one opens the page,
`resolveContext`'s auto-upsert (`oe/index.ts`, `ignoreDuplicates: true`) creates it
from the **global default — 1 free seat**. Same for every sub-account synced from
GHL from now on. At RM 397 that is up to ~RM 2,779 of uncollected revenue across
the seven, and it only materialises if someone actually books.

Owner's call, not a silent fix. The options are to zero
`default_free_seats`, to backfill 0/0 rows for the seven, or to leave the one free
seat as a deliberate welcome gift.

### Admin side of the 票/座 work — DONE 2026-08-05

All seven planned items shipped in one commit, plus two the plan did not contain:

1. `free_tickets` removed from the settings form.
2. `default_free_seats` is READ-ONLY, showing the stored value, with copy that states
   the policy rather than warning about it.
3. 「全局默认（N 票 / N 座）」→ seats only, and the sub-account list now says out
   loud that pressing 保存 on an unedited row freezes the inherited default into an
   override.
4. `updateSubaccountSettings(locationId, free_seats)` — dropped rather than passed a
   constant 0, because a parameter accepted and ignored is how the field survived
   this long.
5. Migration `20260805070000` marks both columns and sets their defaults to 0 (they
   were 1 and **2**; any future INSERT omitting them would have granted two free
   seats). Columns NOT dropped.
6. **Beyond plan:** both `default_free_*` keys removed from the server allow-list, so
   the read-only box is not a decorative guard over a writable endpoint — the same
   shape as the `sst_rate` hole still open elsewhere in this file.
7. **Beyond plan:** `oe` no longer writes `free_tickets`, no longer returns
   `freeTickets` to customers, and no longer reads `default_free_tickets`.

Production verification, in order, with the migration applied before the functions:

| Check | Result |
|---|---|
| Column defaults | `1` / `2` → **`0` / `0`**, comments present in the database |
| Customer `resolveContext` | `freeTickets` absent; `freeSeats` chain intact |
| Frontend build shipped | new strings present in the served bundle, 「默认免费票（张）」 gone |
| Read-only box | shows the stored value (owner confirmed `2`) |
| **Overwrite window** | **4 charge saves at 07:43:40; `default_free_seats` still 07:33:14** |
| Audit payload, settings | 3 fields, no `default_free_*` |
| Allowance round-trip | 0→1→0 both written; payloads `{free_seats, location_id}` |
| Column state | 918 rows, zero non-zero seats, zero non-zero tickets |

**Two process lessons, both from this verification rather than the code:**

- The row save button is `disabled={!dirty}` and the charges button is not. A test
  step of “save without changing anything” is a no-op on the first and real on the
  second — two verification rounds were spent before that was noticed. Check a
  button’s disabled condition before writing a test step that depends on clicking it.
- `updated_at` is the honest witness. “The value is what I expected” could not
  distinguish “saved and left alone” from “never saved”; the timestamp could.

## Free-allowance policy — 2 for new customers, 0 for the existing 918

**This is the design. It looks like leftover state and is not.** Anyone who finds
918 sub-account rows at `0 / 0` next to a global default of `2` will be tempted to
"fix" one of them. Don't.

- **A new sub-account gets 2 free seats** — a welcome gift, applied the first time
  it opens the page, from `oe_settings.default_free_seats`.
- **The 918 that existed before 2026-08-05 get 0.** They have already had their
  free use.
- Anything beyond that is a deliberate per-account grant in the admin's
  sub-account list. Never inherited by existing.

RM 794 of uncollected revenue per new sub-account (2 × RM 397), and only if they
book.

**Why the two halves don't collide:** all 918 accounts hold an *explicit* `0` row,
so the global default reaches nothing that already exists — it applies only to
sub-accounts synced from GHL afterwards. That is exactly what backfilling the last
7 rows bought: before it, 7 accounts had no row and would have inherited whatever
the default said, silently.

**Changing it is a SQL statement, by design** — both `default_free_*` keys were
removed from `updateSettings`'s allow-list, and the admin box is read-only. SQL
writes no `admin_audit_log` row, so every such change is recorded in
`docs/cleanup/` instead; see `2026-08-05-oe-free-allowance-policy.md` for both
steps and their read-backs. Before changing it again, check that no
`ghl_locations` row lacks an `oe_subaccount_settings` row, or an existing account
will inherit the new number without anyone deciding that.

## Verification rule: static checks do not cover the Edge Functions

Two defects in one change were caught by a repo-wide grep and by nothing else,
because `supabase/functions/**` has no local typecheck (no `deno` on this machine,
`tsconfig.app.json` covers `src` only) and the Supabase bundler strips types
without checking them:

1. **A required field left on a type after its assignment was deleted.** Removing
   `defaultFreeTickets` from `loadSettings` left it required on `OeSettings`. `tsc`
   never sees this file, so it would have surfaced as a deploy failure.
2. **A type that lied.** `updateSettings`'s `Partial` still offered the two
   `default_free_*` keys after the server stopped accepting them. Worse than a
   stale comment — a type is trusted more.

**So: after any change touching an Edge Function, grep the whole repo for every
identifier you removed and account for each surviving hit** (read path, wire-shape
type, comment). `tsc`, `eslint` and `npm test` passing means nothing about these
files. The same applies to the deploy-order rule recorded with migration
`20260805070000`: when code changes to rely on a database default, the migration
goes first.
