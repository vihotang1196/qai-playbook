# QAI Offline Event — Rebuild Progress

Rebuild of **Offline Event** (5th migrated tool) into this Playbook project,
ported from a Lovable export. It is a **line-up event booking system**: pick an
event date → choose seats on a floor-plan seat map → add lunch → **pay via
Stripe (MYR + 8% SST)** → get a **QR e-ticket on the web page** → staff **scan
the QR to check in** (2-day event: day1/day2). **IN PROGRESS — P0 + P1 done.**

This file records the owner's locked decisions, the old-version facts, and the
phased plan so a new session can pick up without re-researching.

_Last updated: 2026-07-22 — P5 CODE COMPLETE + DEPLOYED to hkqzz (committed +
pushed). Stripe = Hosted Checkout (owner chose redirect over embedded); DIRECT
Stripe (no Lovable gateway); dual-key structure (sandbox→_TEST / live→_LIVE, mode
from oe_settings.stripe_payment_mode). **DESIGN PIVOT (owner, 2026-07-22): NO webhook
for now** — confirmation happens on the /checkout/return page: the browser hands the
session_id to the `confirmBooking` oe action → server RETRIEVES the session with the
secret key → confirms only if Stripe says paid (browser's word never trusted).
`oe-stripe-webhook` fn code is LEFT deployed but DORMANT (nothing calls it; owner may
add it later as a missed-order backstop). Seat release without the expired webhook =
lazy `sweepStalePending` (reconciles pending >35min on seat-map view / new booking;
verifies with Stripe before releasing so a late-paid order is promoted not dropped).
Owner stored OE_STRIPE_SECRET_KEY_TEST + _LIVE (webhook secrets NOT needed in this
model). REMAINING before P5 "done": owner runs the end-to-end pay test (localhost or
deployed, card 4242) → sees pending→confirmed + QR. Verified so far: tsc clean; oe
redeployed; unpaid session correctly stays pending; wrong-location→not_found; the
real booking UI redirects to Stripe hosted checkout (Sandbox, MYR, AJ ENDLESS ASIA
SDN BHD). Prior phases P0–P4 done._

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
- [~] **P5 — Paid booking + Stripe ⭐ (CODE COMPLETE + DEPLOYED 2026-07-22; e2e pay
  test pending).** Owner chose **Hosted Checkout** (redirect, not embedded) and (pivot)
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
  ~35min if unpaid). REMAINING: owner runs the full pay test (4242) → pending→confirmed
  + QR; optional: add webhook backstop later.
- [ ] **P6 — E-ticket + QR + check-in.** Ticket page (big QR, screenshot-friendly);
  admin CheckInScanner (camera → requireAdmin fn → mark day1/day2 attended,
  idempotent); optional self-check-in.
- [ ] **P7 — Admin: bookings + event-dates + settings.** List/search/change-date/
  change-seat/archive bookings; event-date CRUD (per-event price); capacity; Stripe
  mode toggle; per-Sub-Account free allowance (reconcile with location_tool_access).
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
