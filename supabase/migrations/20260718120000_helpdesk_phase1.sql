-- ════════════════════════════════════════════════════════════════════════
-- Helpdesk — Phase 1 schema   (4th migrated tool: QAI's shared AI help center)
--
-- ADDITIVE ONLY. Every statement is CREATE ... IF NOT EXISTS / CREATE OR
-- REPLACE / a guarded DO-block. There is NOT a single DROP or ALTER of any
-- EXISTING object anywhere in this file — nothing Review Boost (rb_*, the shared
-- ghl_locations), the Admin Portal (platform_admins, location_tool_access,
-- admin_audit_log, tool_usage), or the copywriter uses is touched. Every new
-- table is hd_-prefixed (Helpdesk-owned).
--
-- Ported (concept-aligned, NOT copied) from the old Lovable Helpdesk export's
-- final schema, with three owner-locked changes (see PROGRESS-HELPDESK.md):
--   • DROP the dead pgvector scaffolding. The old knowledge_entries.embedding
--     column + match_knowledge RPC were never wired up. They are deliberately
--     NOT created here — this DB has no pgvector extension, no embedding column,
--     no RPC. Nothing to drop; simply never introduced.
--   • SHARED help center → NO per-client / per-location content scoping. The old
--     ghl_settings (per-sub-account widget enrolment) is intentionally NOT
--     ported. Conversations still carry an OPTIONAL location_id for analytics
--     attribution only (owner decision) — never to scope or hide content.
--   • SECURITY FIX. The old Helpdesk had NO login and effectively WIDE-OPEN RLS
--     (anon read/write on content; the Notion API key anon-readable). Here EVERY
--     hd_ table has RLS ON with NO policy → service-role only. All access goes
--     through edge functions: admin management via the requireAdmin-gated fn, the
--     public widget via a service-role public fn. The frontend never touches
--     these tables directly (same model as the Admin Portal + Review Boost).
--
-- Table map (old → new):
--   knowledge_folders       → hd_folders
--   knowledge_entries       → hd_articles               (embedding column dropped)
--   conversations           → hd_conversations
--   messages                → hd_messages
--   message_feedback        → hd_message_feedback
--   support_analytics       → hd_support_analytics
--   faq_entries             → hd_faq
--   system_updates          → hd_updates
--   widget_settings         → hd_widget_settings         (singleton)
--   notion_settings         → hd_notion_settings         (singleton; api_key now
--                                                          service-role only)
--   deleted_notion_entries  → hd_deleted_notion_entries  (Notion-sync tombstones)
--   ghl_settings            → (not ported — a shared help center needs no
--                              per-sub-account enrolment)
-- ════════════════════════════════════════════════════════════════════════


-- Shared updated_at trigger fn already exists (Review Boost Phase 1). Re-assert
-- it idempotently so this migration is self-contained; the body is identical.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ════════════════════════════════════════════════════════════════════════
-- KNOWLEDGE BASE  ·  hd_folders + hd_articles
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.hd_folders (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  icon        text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.hd_articles (
  id          uuid primary key default gen_random_uuid(),
  folder_id   uuid references public.hd_folders (id) on delete set null,
  title       text not null,
  content     text not null default '',        -- markdown body (what Claude reads via tool-use)
  category    text not null default 'general',
  source      text not null default 'manual',  -- manual | notion
  source_id   text,                            -- Notion page id (sync dedup); null for manual
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists hd_articles_folder_idx   on public.hd_articles (folder_id);
create index if not exists hd_articles_source_idx    on public.hd_articles (source, source_id);
create index if not exists hd_articles_category_idx  on public.hd_articles (category);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_hd_articles_updated_at') then
    create trigger set_hd_articles_updated_at
      before update on public.hd_articles
      for each row execute function public.set_updated_at();
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════════════
-- CONVERSATIONS  ·  hd_conversations + hd_messages + hd_message_feedback
--   location_id is OPTIONAL analytics attribution only (which sub-account the
--   visitor came from) — NEVER used to scope/hide content. NO FK: a visitor may
--   arrive from a location not synced into ghl_locations, so keep it free-form
--   (same choice as the shared tool_usage table).
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.hd_conversations (
  id           uuid primary key default gen_random_uuid(),
  visitor_id   text not null,
  visitor_name text,
  status       text not null default 'open',    -- open | closed | …
  channel      text not null default 'web',
  location_id  text,                            -- analytics attribution only (nullable, NO FK)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists hd_conversations_location_idx on public.hd_conversations (location_id);
create index if not exists hd_conversations_visitor_idx  on public.hd_conversations (visitor_id);
create index if not exists hd_conversations_created_idx   on public.hd_conversations (created_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_hd_conversations_updated_at') then
    create trigger set_hd_conversations_updated_at
      before update on public.hd_conversations
      for each row execute function public.set_updated_at();
  end if;
end $$;

create table if not exists public.hd_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.hd_conversations (id) on delete cascade,
  role            text not null,                -- user | assistant | agent
  content         text not null,
  was_edited      boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists hd_messages_conversation_idx on public.hd_messages (conversation_id);

create table if not exists public.hd_message_feedback (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.hd_conversations (id) on delete cascade,
  message_index   integer not null,             -- which message in the thread
  rating          text not null,                -- up | down
  message_excerpt text,
  location_id     text,                         -- analytics attribution only
  visitor_id      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists hd_message_feedback_conversation_idx on public.hd_message_feedback (conversation_id);
create index if not exists hd_message_feedback_location_idx      on public.hd_message_feedback (location_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_hd_message_feedback_updated_at') then
    create trigger set_hd_message_feedback_updated_at
      before update on public.hd_message_feedback
      for each row execute function public.set_updated_at();
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════════════
-- ANALYTICS  ·  hd_support_analytics   (one row per question asked)
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.hd_support_analytics (
  id           uuid primary key default gen_random_uuid(),
  question     text not null,
  topic        text,
  ai_answered  boolean not null default false,
  was_helpful  boolean,
  location_id  text,                            -- analytics attribution only
  created_at   timestamptz not null default now()
);
create index if not exists hd_support_analytics_created_idx  on public.hd_support_analytics (created_at desc);
create index if not exists hd_support_analytics_location_idx on public.hd_support_analytics (location_id);


-- ════════════════════════════════════════════════════════════════════════
-- HELP CENTER CONTENT  ·  hd_faq + hd_updates
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.hd_faq (
  id          uuid primary key default gen_random_uuid(),
  question    text not null,
  answer      text,
  category    text not null default 'general',
  link        text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists hd_faq_category_idx on public.hd_faq (category);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_hd_faq_updated_at') then
    create trigger set_hd_faq_updated_at
      before update on public.hd_faq
      for each row execute function public.set_updated_at();
  end if;
end $$;

create table if not exists public.hd_updates (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  category    text not null default 'update',
  image_url   text,
  link        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists hd_updates_created_idx on public.hd_updates (created_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_hd_updates_updated_at') then
    create trigger set_hd_updates_updated_at
      before update on public.hd_updates
      for each row execute function public.set_updated_at();
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════════════
-- SETTINGS (singletons)  ·  hd_widget_settings + hd_notion_settings
--   One row each. hd_notion_settings.api_key is SENSITIVE — with no RLS policy
--   it is service-role only (fixes the old export's anon-readable Notion key).
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.hd_widget_settings (
  id                 uuid primary key default gen_random_uuid(),
  header_title       text not null default 'Help Center',
  header_description text not null default '',
  logo_url           text,
  primary_color      text not null default '#FF3D6E',
  widget_size        text not null default 'standard',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_hd_widget_settings_updated_at') then
    create trigger set_hd_widget_settings_updated_at
      before update on public.hd_widget_settings
      for each row execute function public.set_updated_at();
  end if;
end $$;

create table if not exists public.hd_notion_settings (
  id           uuid primary key default gen_random_uuid(),
  api_key      text not null default '',
  database_ids text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_hd_notion_settings_updated_at') then
    create trigger set_hd_notion_settings_updated_at
      before update on public.hd_notion_settings
      for each row execute function public.set_updated_at();
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════════════
-- NOTION SYNC TOMBSTONES  ·  hd_deleted_notion_entries
--   Remembers Notion pages the admin deleted, so a re-sync won't re-import them.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.hd_deleted_notion_entries (
  id         uuid primary key default gen_random_uuid(),
  source_id  text not null,
  deleted_at timestamptz not null default now()
);
create index if not exists hd_deleted_notion_source_idx on public.hd_deleted_notion_entries (source_id);


-- ════════════════════════════════════════════════════════════════════════
-- Row Level Security — every hd_ table: RLS ON with NO policy → service-role
-- only. All access is via edge functions (admin mgmt: requireAdmin-gated; the
-- public widget: a service-role public fn). The frontend never touches these
-- tables directly. This is the fix for the old export's wide-open anon RLS.
-- ════════════════════════════════════════════════════════════════════════
alter table public.hd_folders                enable row level security;
alter table public.hd_articles               enable row level security;
alter table public.hd_conversations          enable row level security;
alter table public.hd_messages               enable row level security;
alter table public.hd_message_feedback       enable row level security;
alter table public.hd_support_analytics      enable row level security;
alter table public.hd_faq                    enable row level security;
alter table public.hd_updates                enable row level security;
alter table public.hd_widget_settings        enable row level security;
alter table public.hd_notion_settings        enable row level security;
alter table public.hd_deleted_notion_entries enable row level security;


-- ── Seed the singleton settings rows (guarded) so the admin has a row to edit
--    and the widget has default branding immediately. Idempotent. ────────────
insert into public.hd_widget_settings (header_title, header_description)
select 'Help Center', ''
where not exists (select 1 from public.hd_widget_settings);

insert into public.hd_notion_settings (api_key, database_ids)
select '', '{}'
where not exists (select 1 from public.hd_notion_settings);
