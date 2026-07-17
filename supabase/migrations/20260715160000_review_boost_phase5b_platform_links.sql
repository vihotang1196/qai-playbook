-- ════════════════════════════════════════════════════════════════════════
-- Review Boost — Phase 5b: platform links become MULTIPLE-per-platform + named
--
-- Owner-approved (2026-07-15). A sub-account can now store MANY review links per
-- platform (e.g. several Google pages for several branches), each with an
-- OPTIONAL name/label. "Has a link" = configured, so the on/off toggle is gone.
--
-- Scope: changes to our OWN rb_platform_integrations table ONLY. Does NOT touch
-- any other table, the copywriter, or campaign data. Existing rows are PRESERVED;
-- the campaign→link foreign key references each link's PRIMARY KEY (id), so
-- dropping the unique(location_id, platform) constraint does not affect it.
-- ════════════════════════════════════════════════════════════════════════

-- 1) Drop the one-link-per-platform limit: unique(location_id, platform).
--    Postgres auto-named this constraint, so look it up and drop it by name
--    (robust to whatever the exact name is). The PRIMARY KEY is contype 'p',
--    not 'u', so it is never matched here — only the lone UNIQUE constraint is.
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.rb_platform_integrations'::regclass
    and contype = 'u';
  if cname is not null then
    execute format('alter table public.rb_platform_integrations drop constraint %I', cname);
  end if;
end $$;

-- 2) Add the optional per-link name/label (NULL = unnamed → the UI shows the URL).
alter table public.rb_platform_integrations
  add column if not exists label text;

-- 3) Remove the on/off toggle — presence of a link now means it's usable.
alter table public.rb_platform_integrations
  drop column if exists is_enabled;
