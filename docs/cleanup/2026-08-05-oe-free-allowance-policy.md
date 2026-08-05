# Offline Event — free-allowance policy, set by SQL (2026-08-05)

**Why this file exists.** These changes were made with `supabase db query --linked`
against production, and **SQL writes no `admin_audit_log` row**. That gap is not
theoretical: the reason this work happened at all is that a SQL change on
2026-07-29 was silently reverted and nothing recorded either event. Anything done
to `oe_settings` outside the admin UI gets written down here.

As of this file the admin UI **cannot** write these keys at all — both
`default_free_*` were removed from `updateSettings`'s allow-list, so SQL is the
only path by design. Expect to come back here.

Owner approved each step below before it ran.

---

## The policy, stated plainly

- **A new sub-account gets 2 free seats.** It is a welcome gift for new customers,
  applied the first time they open the page.
- **The 918 sub-accounts that existed before 2026-08-05 get 0.** They have already
  had their free use.
- A grant beyond that is a deliberate per-account act in the admin's sub-account
  list, never something inherited by existing.

**So the steady state is: 918 rows of `0 / 0`, and a global default of `2`. That
combination is the design, not leftover state — do not "fix" it.** A future
sub-account synced from GHL will get a `2` row and be the odd one out on purpose.

Cost of the gift, for the record: 2 seats at RM 397 is RM 794 of revenue not
collected per new sub-account, and it only materialises if they actually book.

---

## Step 1 — zero the defaults, and close the gap that made them reachable

Ran first, before the policy change, because the audit that prompted it found the
global defaults were `1 / 1` while everyone believed they were `0 / 0`.

```sql
update oe_settings set value='0', updated_at=now()
 where key in ('default_free_tickets','default_free_seats');

insert into oe_subaccount_settings (location_id, free_tickets, free_seats, updated_at)
select l.location_id, 0, 0, now() from ghl_locations l
on conflict (location_id) do nothing;
```

`do nothing`, not `do update`: the 911 existing rows were already `0 / 0` and
re-writing them would have reset every `updated_at`, destroying the record of
which rows were the 2026-07-28 batch and which one was touched separately on
07-29. That distinction was load-bearing evidence an hour later.

Read back:

| | before | after |
|---|---|---|
| `default_free_tickets` | `1` | **`0`** |
| `default_free_seats` | `1` | **`0`** |
| `oe_subaccount_settings` rows | 911 | **918** |
| Locations with no row | **7** | **0** |
| Rows not `0 / 0` | 0 | 0 |

`updated_at` distribution after the insert — 910 on 2026-07-28, 1 on 07-29, **7 on
08-05**. Exactly the seven new rows, nothing else disturbed.

Those 7 were the whole point. Each had no settings row, so the first visit would
have auto-created one from the global default — 7 free seats nobody decided to
give, plus every future GHL sync.

## Step 2 — the welcome gift

Only safe *because* step 1 backfilled those seven rows. With all 918 accounts
holding an explicit `0`, the global default now reaches **nothing that exists** —
it applies solely to sub-accounts synced from GHL after this point.

```sql
update oe_settings set value='2', updated_at=now()
 where key='default_free_seats';
```

`default_free_tickets` deliberately left at `0`: the column was deprecated the
same day (migration `20260805070000`) after an audit showed it never affected
pricing, validation or the customer UI.

Read back:

| | value |
|---|---|
| `default_free_seats` | **`2`** |
| `default_free_tickets` | `0` (deprecated) |
| `oe_subaccount_settings` rows | 918 |
| Rows still `0 / 0` | **918** — no existing account moved |
| Rows with non-zero seats | **0** |
| Locations with no row | **0** |

---

## If you change this again

1. Check `select count(*) from ghl_locations l where not exists (select 1 from
   oe_subaccount_settings s where s.location_id = l.location_id)` **first**. If it
   is not 0, some existing account will silently inherit whatever you set.
2. Change the value, read it back, and add a section here.
3. No deploy needed — `oe` reads `oe_settings` per request.
