-- ════════════════════════════════════════════════════════════════════════
-- Copywriter history — every generation the customer paid for, kept.
--
-- ADDITIVE ONLY. Creates ONE new table. Touches nothing else: no drops, no
-- alters, and in particular NO change to tool_usage, which keeps receiving its
-- `generation` / `generation_result` rows exactly as before. The recover flow
-- (the refresh-mid-generation double-charge guard in generate-copy) still reads
-- tool_usage and is deliberately left alone by this migration.
--
-- WHY: a generation is the priciest call on the platform and, until now, the
-- only place the OUTPUT survived was tool_usage.meta.result — reachable solely
-- by a requestId that lives in localStorage and expires after 4 minutes. Once
-- that marker is gone the copy is unreachable forever, even though it is still
-- sitting in the database. This table is the customer-facing home for it: a
-- list they can come back to, read in full, and reuse as a template.
--
-- SHAPE:
--   location_id  the GHL sub-account. EVERY query filters on it — a location is
--                one team, and the history is shared within it (a colleague can
--                see "our copy"). The UI must say so out loud; do not let anyone
--                read this list as private-to-me.
--   request_id   NULLABLE on purpose — see the warning below.
--   product_name the list title. Nullable: rows written before the survey was
--                captured have no product name to show.
--   input        the full questionnaire, which is what makes "regenerate from
--                this one" possible. Nullable — not because it is optional (the
--                edge fn must write it every time), but because a constraint
--                must never be the reason paid-for work is lost. See below.
--   result       the generated copy, same shape the frontend already renders.
--   deleted_at   SOFT delete. "Delete" writes a timestamp; the row stays.
--                The single most common complaint about any history feature is
--                "I deleted it by accident", and one nullable column buys the
--                way back for essentially nothing. Every list query MUST carry
--                `where deleted_at is null`.
--
-- ⚠️ THE MISTAKE THIS TABLE MUST NOT REPEAT ⚠️
--   The existing result-parking code in generate-copy (~line 1278) is wrapped in
--   `if (requestId)`. It looked harmless — an unkeyed row could not be matched
--   back to its browser, so why write it? The bill says otherwise: of 18 charged
--   generations, only 8 left a result behind. Roughly 5 successful, paid-for
--   generations were thrown away because a browser-side id happened to be
--   missing.
--   Writing to THIS table must never be conditional on request_id. The customer
--   paid; the output gets stored. A missing request_id is stored as NULL — it is
--   a convenience key for the recover flow, never a precondition for keeping
--   what someone bought. That is why the column is nullable and carries no
--   unique constraint.
--
--   THE SAME REASONING IS WHY `input` IS NULLABLE, and it is worth spelling out
--   because the first draft of this table got it wrong. `input not null` looks
--   like good hygiene — every row SHOULD have its questionnaire. But a NOT NULL
--   is just another precondition, enforced one layer down: hand it a row whose
--   input came back malformed and the INSERT fails, taking the whole record with
--   it. That is the `if (requestId)` bug again, wearing a schema constraint as a
--   disguise. Weigh the two failure modes:
--       NOT NULL, worst case → customer paid, generation succeeded, row lost.
--       nullable, worst case → one button in the UI is greyed out.
--   The second is enormously cheaper, so the column is nullable. This is NOT a
--   licence to skip it: the edge fn writes `input` on EVERY insert, and the list
--   UI greys out "regenerate from this one" when it is null
--   (`disabled={!row.input}`). A database constraint should describe the shape
--   of the data, never become the reason paid-for work disappears.
--
-- NOTE ON `language`: no CHECK constraint. It mirrors SurveyInput.language
-- (zh/en/ms), which TypeScript already constrains at both ends, and a database
-- CHECK would turn "add Tamil" into a schema migration for no safety gained.
--
-- SECURITY: RLS ON with NO policy → service role only. This is INTENTIONAL and
-- not an omission: the frontend never reads this table directly (an anon read of
-- an RLS-locked table returns an empty list, not an error, which is exactly the
-- kind of silent wrong answer we refuse to build on). All access goes through
-- the anon-callable `generate-copy` edge fn, which runs with the service role
-- and scopes every query by the request's location_id. Same model as tool_usage,
-- hd_*, oe_* and coaching_sessions.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.copy_generations (
  id           uuid primary key default gen_random_uuid(),
  location_id  text not null,           -- the GHL sub-account this belongs to
  request_id   text,                    -- nullable BY DESIGN (see warning above)
  product_name text,                    -- list title; null on rows with no survey
  language     text not null,           -- zh | en | ms (the OUTPUT language)
  input        jsonb,                   -- the questionnaire; nullable BY DESIGN
  result       jsonb not null,          -- the generated copy
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz              -- null = live; set = soft-deleted
);

-- The one hot path: "this account's history, newest first". Partial on
-- deleted_at so soft-deleted rows cost nothing to skip and never bloat the
-- index — the list query's `where deleted_at is null` matches this exactly.
create index if not exists copy_generations_location_created_idx
  on public.copy_generations (location_id, created_at desc)
  where deleted_at is null;

-- NOTE: no index on request_id yet. Nothing queries by it — the recover flow
-- still reads tool_usage. If recovery is ever moved onto this table, add
--   create index ... on public.copy_generations (request_id);
-- at that point rather than carrying an unused index until then.

alter table public.copy_generations enable row level security;
-- Intentionally NO policy: service role only (same model as tool_usage / hd_* /
-- oe_*). Deleting this line, or adding an anon policy, would expose every
-- customer's product pricing and USPs to anyone holding the public anon key.
