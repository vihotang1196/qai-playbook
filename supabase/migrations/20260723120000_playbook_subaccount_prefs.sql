-- Playbook shared per-sub-account preferences (tool-neutral; `pb_` prefix).
--
-- The FIRST cross-tool preference table. Currently holds one thing: the
-- customer-chosen "default landing page" for a sub-account, so opening Playbook
-- from that sub-account's GHL menu link lands them on their chosen page.
--
-- Keyed by GHL location_id (trust-the-URL identity — this is a low-stakes UI
-- preference, not auth/money; anyone in the sub-account with the location_id may
-- change it, by owner's decision). `default_path` is a relative in-app path
-- (e.g. "/events", "/help", "/"); validated in the `ghl` edge fn before write.
--
-- RLS ON with NO policy → only the service role (edge fns) can read/write it;
-- the frontend never touches this table directly (it goes through the public
-- `ghl` fn's getSubaccountPrefs / setSubaccountPrefs actions). Same posture as
-- the oe_/hd_ tables. Additive only.

create table if not exists public.pb_subaccount_prefs (
  location_id  text primary key,
  default_path text,
  updated_at   timestamptz not null default now()
);

alter table public.pb_subaccount_prefs enable row level security;
-- (intentionally no policies → service-role only)
