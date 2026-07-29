-- ════════════════════════════════════════════════════════════════════════
-- Offline Event — schedule the stale-pending sweep (batch 6, commit 3).
--
-- Until now the sweep only ran when a customer happened to load a seat map or
-- start a booking. An event nobody is browsing kept its seats locked for as long
-- as nobody looked at it. This runs it every 2 minutes regardless of traffic; the
-- lazy triggers stay in place as a second line.
--
-- Seats are held HOLD_STALE_MINUTES = 10, so with a 2-minute tick the real
-- release lands between 10 and 12 minutes after checkout started. A round with
-- nothing to do costs one HTTP call and zero Stripe calls.
--
-- THE SHARED SECRET IS READ FROM VAULT BY NAME. Its value is never written here,
-- so this file is safe in git. The same value must ALSO exist in Supabase Edge
-- secrets as OE_CRON_SECRET — that is what the `oe` function compares against.
-- Two places, one value: change one without the other and this job silently 401s
-- every two minutes. (The function-side comment says the same thing.)
-- ════════════════════════════════════════════════════════════════════════

-- Fail LOUDLY at migration time if the extensions aren't on. The alternative —
-- installing a job that can never run — is the hardest kind of failure to notice,
-- because everything looks scheduled.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron is not enabled (Dashboard → Database → Extensions)';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'pg_net is not enabled (Dashboard → Database → Extensions)';
  end if;
end $$;

-- Re-runnable: drop any previous version of the job before scheduling it again.
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

    -- pg_net lives in the `extensions` schema on this project, so every call is
    -- FULLY QUALIFIED. An unqualified net.http_post() resolves fine in an
    -- interactive session (search_path) and then fails inside the cron job — i.e.
    -- on a schedule, where nobody is watching.
    perform extensions.net.http_post(
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
