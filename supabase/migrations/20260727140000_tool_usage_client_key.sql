-- ════════════════════════════════════════════════════════════════════════
-- Pre-launch rate limiting — step 1 (foundation).
--
-- ADDITIVE ONLY: one new NULLABLE column + one new index on the existing
-- tool_usage table. No data is rewritten, no existing column/index/constraint is
-- dropped or altered, and every current writer (generate-review) keeps working
-- unchanged — client_key simply stays null on rows that don't set it. Nothing
-- belonging to the other tools is touched.
--
-- WHY: tool_usage is already the platform-wide usage meter (tool_key +
-- location_id + created_at, service-role only), so it is also the natural
-- counter for rate limiting — one table for both metering and throttling
-- instead of a second bespoke table.
--
-- WHAT client_key IS: the generic throttling dimension, so one shared
-- checkRateLimit() works for every tool no matter what it limits by:
--   loc:<location_id>   per sub-account (the primary dimension — every public
--                       expensive endpoint now REQUIRES a location_id)
--   qr:<short_code>     per QR code (Review Boost's existing per-code caps)
--   ip:<hash>           optional secondary/backstop dimension
-- It is kept separate from location_id (which stays the reporting/billing
-- dimension) so throttling granularity can change without disturbing analytics.
--
-- NOTE: rows accumulate, so counting stays fast only while the window scan is
-- indexed — hence the composite index below, ordered to match the rate-limit
-- query exactly (tool_key + client_key equality, then a created_at range).
-- A retention/prune policy for old rows is a later, separate concern.
-- ════════════════════════════════════════════════════════════════════════

alter table public.tool_usage
  add column if not exists client_key text;

-- The exact shape of the rate-limit lookup:
--   where tool_key = $1 and client_key = $2 and created_at >= now() - window
create index if not exists tool_usage_ratelimit_idx
  on public.tool_usage (tool_key, client_key, created_at desc);
