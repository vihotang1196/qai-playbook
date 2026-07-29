# Offline Event — pre-launch booking wipe, evidence snapshot

**Taken 2026-07-29, immediately before deleting every row of `oe_bookings` and
`oe_booked_seats`.** Read directly from the production database with
`supabase db query --linked`, not from an admin page.

## Why this record exists

The deletion is executed as a **one-off SQL statement**, not through the admin
UI, so **`admin_audit_log` will contain no entry for it**. This file is the
record instead — and a fuller one than an audit row, since it holds the contents
of what was removed rather than the fact that something was.

## Why deleting these is safe

- **All 24 bookings are test data.** Every address is `@test.local`,
  `@example.com`, or the owner's / the team's own
  (`shaofeng@grandvisionx.com`, `chaishaofeng3@gmail.com`,
  `ajsupport002@grandvisionx.com`). No real customer has ever booked.
- **All 24 belong to the internal test sub-account** `gsRRLb2A8IoATd9qWNmh`
  (AJ | QiAi Demo🔥) — verified, the location breakdown is a single row.
- **No real money is involved.** `oe_settings.stripe_payment_mode = "sandbox"` at
  the time of this snapshot, so every `pi_*` / `cs_test_*` reference below is a
  Stripe **test-mode** record. Nothing to reconcile against a real ledger.
- **Owner confirmed the scope on 2026-07-29** after reviewing these numbers.

## What is being deleted

| table | rows |
|---|---|
| `oe_bookings` | **24** (1 `confirmed`, 23 `cancelled`) |
| `oe_booked_seats` | **3** |

## What is being kept — every other table, untouched

| table | rows | note |
|---|---|---|
| `oe_events` | 1 | 盈利营销实战班, 2026-07-31 → 08-01 — a real event that will run |
| `oe_floor_plans` | 1 | the 91-seat plan |
| `oe_settings` | 7 | incl. `stripe_payment_mode=sandbox`, `sst_rate=0.08`, `default_free_*=1` |
| `oe_subaccount_settings` | 911 | **910 of them are `0/0` rows — deleting any would re-open a free allowance for that sub-account** |

Cross-tool shared tables (`admin_audit_log`, `tool_usage`, `ghl_locations`,
`location_tool_access`, `platform_admins`, `platform_settings`) and the
Helpdesk/Notion content are **out of scope and must not be touched**.

## Delete-gate classification

`requiresHardDeleteGate` (see `src/lib/offlineEventDelete.ts`) is TRUE unless a
booking is *provably* money-free — `total = 0` AND no `payment_intent_id` AND no
`stripe_session_id` AND no `receipt_url`.

**17 of the 24 are tier A**, not 15 as first estimated. The count was taken by
running the predicate itself:

```sql
select count(*) from oe_bookings
where not (total = 0 and payment_intent_id is null
           and stripe_session_id is null and receipt_url is null);
-- 17
```

The extra ones are easy to miss by eye: `BK-XQOU-YSTLLS` has **no Stripe
reference at all** but `total = 500.00`, so it is tier A purely on the amount —
an admin-created booking with a price on it. Counting `cs_test_*` references
alone gives 16; counting actual charges (`pi_*`) gives 6.

Note also `BK-JE8N-4TX8W2` — the only `confirmed` row, and the holder of all
three seats — is **tier B**: `total = 0.00` with no Stripe references, so it is
provably money-free despite being confirmed.

## `oe_bookings` — all 24 rows

Ordered by `created_at`. `receipt` is `yes`/`-` rather than the full URL.

| # | booking_id | email | status | total | payment_intent_id | stripe_session_id | receipt | day1 | day2 | archived | by | created_at |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | BK-RNZF-05DQ7M | shaofeng@grandvisionx.com | cancelled | 857.52 | - | cs_test_b1IepjmNgxZHVqbvXGOHuFC0N388WTD8lEf2I6VtVoUTRJFWNiKPxwfIxL | - | pending | pending | f | customer | 2026-07-28 09:11 |
| 2 | BK-12B0-3WTICC | ajsupport002@grandvisionx.com | cancelled | 0.00 | - | - | - | pending | pending | f | customer | 2026-07-28 09:18 |
| 3 | BK-BNVU-BYX1V5 | shaofeng@grandvisionx.com | cancelled | 857.52 | pi_3Ty7Hp3ooXcCBxHP0lFWojiq | cs_test_b1pU0OruJBWO5Zw22BbCXi5TeHEUJL0kq5UyLtjWmu9OALeXpXBshxnYZN | yes | pending | pending | f | customer | 2026-07-28 09:26 |
| 4 | BK-M9LE-S4IXQF | chaishaofeng3@gmail.com | cancelled | 1030.28 | pi_3Ty7qr3ooXcCBxHP0z6eAKCw | cs_test_b1lY8LclapleV4XXBHoQohtzPiwlWNnVJv0jSgGDCEWYcKPvBytCOVaIZf | yes | pending | pending | f | customer | 2026-07-28 10:02 |
| 5 | BK-P34G-G266QR | shaofeng@grandvisionx.com | cancelled | 1887.80 | pi_3Ty7sv3ooXcCBxHP0seGvQU2 | cs_test_b1pQu0HONPOPoCJLoRAvzcMXV6LogsEznXFZoBHKj6wp1fcAAMFtO0DxUw | yes | pending | pending | f | customer | 2026-07-28 10:05 |
| 6 | BK-NOC3-W5VZTN | shaofeng@grandvisionx.com | cancelled | 857.52 | pi_3TyA3R3ooXcCBxHP0AKyJtks | cs_test_b1xY9ar1nU0uHbVX3GYIc1ThEjHBubpPH9bUa6BIszFyu1iMrE29nrXwR0 | yes | pending | pending | f | customer | 2026-07-28 12:23 |
| 7 | BK-8YC1-KNVYK8 | shaofeng@grandvisionx.com | cancelled | 1715.04 | pi_3TyAJJ3ooXcCBxHP0yJaHcCA | cs_test_b1LBkQ18gmHEdQqLyfm0VYWZVnIbdnYKi5mQKazeo9vEhesCFoNey4p1ru | yes | pending | pending | f | customer | 2026-07-28 12:40 |
| 8 | BK-A64O-PZM4MN | shaofeng@grandvisionx.com | cancelled | 1715.04 | - | cs_test_b1yI6XqgwWLz2PhYimZGTwkmWYmtJWZ8JItYlF6xMlS5gEXMgkYhMXD09r | - | pending | pending | f | customer | 2026-07-28 12:41 |
| 9 | BK-AYZT-Z6Q44Y | shaofeng@grandvisionx.com | cancelled | 1715.04 | pi_3TyAL03ooXcCBxHP1iMieCKZ | cs_test_b1AUbYwmbziCinmnOmGBNJlG2B3lw0t6fj8FZDlex6t7JqUGL7keIrRd9N | yes | pending | pending | f | customer | 2026-07-28 12:42 |
| 10 | BK-MHZO-IQQK9J | batch3b-manual@test.local | cancelled | 0.00 | - | - | - | pending | pending | f | admin | 2026-07-28 14:15 |
| 11 | BK-O7PA-GESM02 | batch3b-stripe@test.local | cancelled | 428.76 | - | cs_test_b11Xego59UsHX7n6Sl2OkusOA1D0Q9G0TPKu2o5JYfiWxTaSK4iRlw89iq | - | pending | pending | f | customer | 2026-07-28 14:16 |
| 12 | BK-ASHP-O75KRS | batch55-a@example.com | cancelled | 428.76 | - | cs_test_b1BX3ax5ZfiIiF2FXikj9j54wRxZDcho0VTZglGpSNXntNBz7BrLt73lkw | - | pending | pending | f | customer | 2026-07-29 01:45 |
| 13 | BK-DVJP-62825Y | batch55-a@example.com | cancelled | 428.76 | - | cs_test_b1CTmz4zTyNS0WSSokNCS7XcjDTre7LA11psyIW07jmZncg5AlOxV71TS9 | - | pending | pending | f | customer | 2026-07-29 01:48 |
| 14 | BK-FZFO-RWMWEX | batch55-b@example.com | cancelled | 943.90 | - | cs_test_b1JK0N7haTXofYi7EVtTZsNFHWmhwfTuIDFMa77JKy1cHfKWJnlcXTxL6E | - | pending | pending | f | customer | 2026-07-29 01:49 |
| 15 | BK-Q6KW-JQ67GC | batch55-c@example.com | cancelled | 428.76 | - | cs_test_b16IQJkH4zLANWw90slqsV2OaMhkj2oIa7B2T5rZ4lDP2cUba1nsWxQ8iL | - | pending | pending | f | customer | 2026-07-29 02:25 |
| 16 | BK-OKFM-8AE7F8 | batch5-free2@test.local | cancelled | 0.00 | - | - | - | pending | pending | f | admin | 2026-07-29 02:52 |
| 17 | BK-XP79-B1YWU5 | b7a-free-a@test.local | cancelled | 0.00 | - | - | - | pending | pending | f | admin | 2026-07-29 03:27 |
| 18 | BK-XPZS-2IS98O | b7a-free-b@test.local | cancelled | 0.00 | - | - | - | pending | pending | f | admin | 2026-07-29 03:27 |
| 19 | BK-XQOU-YSTLLS | b7a-paid@test.local | cancelled | 500.00 | - | - | - | pending | pending | f | admin | 2026-07-29 03:27 |
| 20 | **BK-JE8N-4TX8W2** | b6-free-filler@test.local | **confirmed** | 0.00 | - | - | - | pending | pending | f | customer | 2026-07-29 03:44 |
| 21 | BK-LBH4-S34QKA | b6-pending@test.local | cancelled | 428.76 | - | cs_test_b1gsbSh9wimL4PCkwmBOD2zdf3aJEk81LN8SgmuWa4F02Zdvzkasokf9t5 | - | pending | pending | f | customer | 2026-07-29 03:45 |
| 22 | BK-GJZN-D0C3NO | b6-c2-pending@test.local | cancelled | 428.76 | - | cs_test_b1y7x6v6Nd4uvvKFgwO0vNPxSmpsib5qI334prriRlOdtg5Qw5bJXsq8o7 | - | pending | pending | f | customer | 2026-07-29 04:10 |
| 23 | BK-CYZI-CV6GGW | b6-e2e-cron@test.local | cancelled | 428.76 | - | cs_test_b1KXrzHtKCNvOtCYe7YSs3Rp52GRtdUR6wRtrqb4xbTF4fj4B9vbzXHc7B | - | pending | pending | f | customer | 2026-07-29 04:35 |
| 24 | BK-BIJW-QH1HII | b6c4-fit@test.local | cancelled | 0.00 | - | - | - | pending | pending | f | customer | 2026-07-29 05:30 |

No row is archived (`archived = f` throughout) and no day was ever attended
(`day1`/`day2` are `pending` on all 24), so no attendance evidence is lost.

## `oe_booked_seats` — all 3 rows

All three belong to the single `confirmed` booking.

| seat_label | booking_id | status |
|---|---|---|
| G11 Seat 1 | BK-JE8N-4TX8W2 | confirmed |
| G11 Seat 2 | BK-JE8N-4TX8W2 | confirmed |
| G11 Seat 3 | BK-JE8N-4TX8W2 | confirmed |

After the delete, all **91** seats are free.

## Known side effect of the delete

`freeSeatsUsedFor` (`supabase/functions/oe/index.ts`) derives consumption by
counting `free_seats` on non-cancelled, non-archived bookings. Removing every
booking sets it to zero, so the test sub-account `gsRRLb2A8IoATd9qWNmh` goes from
**1 free seat remaining to 4** (its own row is `free_tickets=2, free_seats=4`).

Verified via `resolveContext` immediately before the delete:

```json
{"enabled":true,"businessName":"AJ | QiAi Demo🔥","freeTickets":2,
 "freeSeats":4,"freeSeatsUsed":3,"freeSeatsRemaining":1}
```

This affects only the internal test account. Whether to lower it is a separate
decision from this cleanup.

## Execution log

_Appended after the SQL runs._
