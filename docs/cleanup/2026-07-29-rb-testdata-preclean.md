# Review Boost — pre-launch test-data wipe, evidence snapshot

**Taken 2026-07-29, before deleting both `rb_campaigns` rows and everything that
hangs off them.** Read from production with `supabase db query --linked`.

Same pattern as the Offline Event cleanup
([2026-07-29-oe-bookings-preclean.md](2026-07-29-oe-bookings-preclean.md)):
export → owner reviews → delete → append the execution log here.

## Why this record exists

The delete runs as one-off SQL, so **`admin_audit_log` will hold nothing for
it**. This file is the record.

## A naming trap worth keeping

An earlier pass reported the two campaigns as "AJ Endless Asia" and "Apple" and
concluded one looked real. Both were wrong readings of the **`business_name`**
column — the campaign's own title lives in **`name`**:

| `name` (the campaign) | `business_name` (its merchant profile) |
|---|---|
| Q.AI 2天盈利营销实战班 | AJ Endless Asia |
| Iphone发布会 | Apple |

`business_name` is the merchant identity fed to the AI, not the campaign title.
Owner confirmed **both campaigns are test data**.

## What is being deleted

| table | rows | note |
|---|---|---|
| `rb_campaigns` | **2** | both |
| `rb_qr_codes` | **2** | cascade from campaigns |
| `rb_generations` | **5** | cascade from campaigns |

`rb_platform_integrations` (1 row) is **kept** — it is the real Google Maps
review link, not campaign data. See the open question at the bottom.

## `rb_campaigns` — both rows

| id | name | business_name | industry | platform | short_code | scans |
|---|---|---|---|---|---|---|
| `c401293d-e847-41df-899e-1014f02de63b` | **Q.AI 2天盈利营销实战班** | AJ Endless Asia | AI | google_maps | `pfnbz2f` | **4** |
| `3b5f95b2-11d4-4bdc-aab1-c081a6a82310` | **Iphone发布会** | Apple | 智能手机 | google_maps | `bqzqxyx` | **1** |

## Where the scan counts live

**There is no per-scan detail table.** `rb_qr_codes.scan_count` is a plain
counter — no timestamp, no IP, no user agent per scan. The "4 scans" is the
integer `4` on the `pfnbz2f` row and nothing else. Deleting the campaign
cascades the QR row and the count goes with it; there is no history to preserve
separately.

## `rb_generations` — all 5 rows

| id | campaign | posted | created | text (first 70 chars) |
|---|---|---|---|---|
| `2edf3f1e-2aa0-4a9e-b9d8-88203fdf9f50` | Q.AI 2天盈利营销实战班 | f | 2026-07-17 | 找他们做了landing page跟auto reply系统，真的很专业！现在客户询问自动处理，我省了好多时间… |
| `8223065d-a53e-4e8d-b605-090b5a1e33ed` | Q.AI 2天盈利营销实战班 | f | 2026-07-17 | Really professional team! They helped set up my landing page and the a… |
| `29990e3c-8a82-40aa-b43d-a7a02026391f` | Q.AI 2天盈利营销实战班 | f | 2026-07-17 | 之前一直不懂怎样用AI帮生意，找了AJ Endless Asia做了个landing page加自动回复系统… |
| `df47180f-4028-4bf9-87d6-474957f5e1f5` | Q.AI 2天盈利营销实战班 | f | 2026-07-27 | 之前一直想整个像样的landing page但不懂怎样弄，找了AJ Endless Asia帮忙… |
| `ac9b4fba-43be-4d21-a335-928b75ac83ba` | Iphone发布会 | **t** | 2026-07-28 | 用了iPhone几年了，真的很耐用，到现在还很顺畅。而且跟我的MacBook和AirPods sync得很好… |

One row is marked `posted = true` — a test marking, not a real posted review.

## What is being kept

| table | rows | why |
|---|---|---|
| `rb_platform_integrations` | 1 | the real `google_maps` link → `https://maps.app.goo.gl/ueD7acVjnsZefixH6`. Not campaign data. |
| `ghl_locations`, `tool_usage`, `location_tool_access`, `platform_settings`, … | — | cross-tool, out of scope |

⚠️ **`tool_usage` is not just a log — it is the rate-limit ledger.** The Review
Boost generations counted against `LOCATION_DAILY_CAP` there and those rows stay.

## Open question for the owner

`rb_platform_integrations` has **`label = NULL`** — the link was saved without a
name, which is why the campaign dropdown falls back to showing the raw URL. The
row is being kept; naming it is a separate decision (see the 8b note on making
`label` required).

## Cascade check

`rb_qr_codes.campaign_id` and `rb_generations.campaign_id` are both
`references rb_campaigns(id) on delete cascade`, so deleting the two campaigns
removes their QR codes and generations automatically. The delete statement is
therefore a single `delete from rb_campaigns` — the counts below verify the
cascade actually fired rather than assuming it.

## Execution log

**Executed 2026-07-29 via `supabase db query --linked`,** after the owner
reviewed the rows above and confirmed both campaigns are test data.

### Before

| table | rows |
|---|---|
| `rb_campaigns` | 2 |
| `rb_qr_codes` | 2 |
| `rb_generations` | 5 |
| `rb_platform_integrations` | 1 |

Matches this snapshot exactly.

### The statement

```sql
delete from rb_campaigns;
```

One statement only — `rb_qr_codes.campaign_id` and `rb_generations.campaign_id`
are both `on delete cascade`, so the children go with the parents.

### After — cascade confirmed by count, not assumed

| table | after | expected |
|---|---|---|
| `rb_campaigns` | **0** | 0 ✅ |
| `rb_qr_codes` | **0** | 0 ✅ (cascade fired) |
| `rb_generations` | **0** | 0 ✅ (cascade fired) |
| `rb_platform_integrations` | **1** | 1 ✅ (kept) |

The two child tables were never named in the statement. They went to zero on
their own, which is the cascade doing its job.

### The kept link, read back in full

```
platform    google_maps
label       (NULL)
review_url  https://maps.app.goo.gl/ueD7acVjnsZefixH6
location_id gsRRLb2A8IoATd9qWNmh
```

Intact. Still unnamed — with the campaigns gone this is now the only Review
Boost row in the database, and the campaign dropdown will show it as
「未命名链接（去平台页命名）」 until someone names it.

### No audit-log entry

As with the Offline Event wipe: the delete ran as CLI SQL, so `admin_audit_log`
has no row for it. This file is the record.
