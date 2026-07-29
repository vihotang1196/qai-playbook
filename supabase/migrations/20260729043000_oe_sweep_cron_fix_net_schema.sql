-- ════════════════════════════════════════════════════════════════════════
-- Offline Event — fix the sweep cron's pg_net call (batch 6, commit 3b).
--
-- 20260729040000 scheduled the job with `extensions.net.http_post(...)` and every
-- run failed with:
--
--     ERROR: cross-database references are not implemented: extensions.net.http_post
--
-- WHY: a three-part name in Postgres is DATABASE.SCHEMA.FUNCTION, so
-- `extensions.net.http_post` asks for a database called `extensions`. pg_net's
-- EXTENSION RECORD sits in the `extensions` schema, but the functions it installs
-- live in their own top-level `net` schema. `net.http_post` is therefore already
-- fully qualified — it does NOT depend on search_path, and prefixing it does not
-- make it "more qualified", it makes it invalid.
--
-- ⚠️ DO NOT "fix" this back by adding the prefix. If a future reader sees the
-- extension listed under `extensions` and reaches for `extensions.net.*`, this
-- comment is why they shouldn't.
--
-- ⚠️ AND NOTE HOW THIS SURFACED: the broken migration APPLIED CLEANLY. The job
-- body is a string to Postgres until cron runs it, so nothing was validated at
-- migration time — the failure only appeared in cron.job_run_details, two minutes
-- later, and would have sat there indefinitely. Applying a cron migration is not
-- the same as shipping the feature; always go back and confirm `succeeded`.
--
-- Everything else is unchanged from 20260729040000: Vault-by-name secret, the
-- noisy warning when it's missing, the 120s timeout, the 2-minute schedule and
-- the hardcoded function URL.
-- ════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron is not enabled (Dashboard → Database → Extensions)';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'pg_net is not enabled (Dashboard → Database → Extensions)';
  end if;
end $$;

-- Re-runnable: drop the previous version of the job before scheduling it again.
select cron.unschedule('oe-sweep-stale')
where exists (select 1 from cron.job where jobname = 'oe-sweep-stale');

select cron.schedule(
  'oe-sweep-stale',
  '*/2 * * * *',
  $job$
  do $inner$
  declare
    v_secret text;
  begin
    select decrypted_secret into v_secret
      from vault.decrypted_secrets
     where name = 'oe_cron_secret';

    -- A missing secret must be NOISY. Skipping quietly would mean the job "runs"
    -- every two minutes doing nothing at all, and the seat-release feature would
    -- be discovered to have never worked months later. This lands in
    -- cron.job_run_details.return_message and the Postgres log.
    if v_secret is null or v_secret = '' then
      raise warning 'oe-sweep-stale: vault secret "oe_cron_secret" is missing — sweep NOT triggered';
      return;
    end if;

    -- TWO parts, not three. See the header: `net` is a top-level schema.
    perform net.http_post(
      url     := 'https://hkqzzfyigmvisaftdmwh.supabase.co/functions/v1/oe',
      headers := jsonb_build_object(
                   'content-type',     'application/json',
                   'x-oe-cron-secret', v_secret
                 ),
      body    := jsonb_build_object('action', 'sweepAll'),
      -- pg_net defaults to 5s. A full round is up to 50 bookings at 1–2 Stripe
      -- calls each. Overlapping rounds are prevented by the function's own
      -- oe_settings lock, so a slow round delays the next one instead of doubling.
      timeout_milliseconds := 120000
    );
  end
  $inner$;
  $job$
);
