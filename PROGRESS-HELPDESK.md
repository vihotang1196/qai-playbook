# QAI Helpdesk — Rebuild Progress

Rebuild of the **Helpdesk** (4th migrated tool) into this Playbook project,
ported from a Lovable export. **NOT STARTED — planning only.** This file records
the owner's locked decisions + the old-version facts so a new session can pick up
without re-researching.

_Last updated: 2026-07-17 — decisions locked; research done; no code written yet._

## Where to build it
- **Old version (read-only reference):** `C:\Users\chais\Projects\QAI Helpdesk`
  (a Lovable export; DO NOT edit it, DO NOT copy it into the Playbook repo). Same
  read-only-sibling pattern used for `QAI Review Boost`.
- **New branch:** cut `feat/helpdesk` **from `feat/admin-portal`** (recommended) —
  that branch already has the reusable Admin Portal auth (requireAdmin + the
  `platform_admins` allowlist + the light admin shell), the shared `ghl_locations`
  + `tool_usage`, and the `_shared/*` Deno helpers. Confirm with owner before cutting.
- **Supabase:** reuse the shared **Playbook** project `hkqzzfyigmvisaftdmwh` (like
  every other tool); the old Helpdesk used its own project `mgygxonqmjmjlboapgcz`
  — do NOT reuse that.

## Owner decisions (locked 2026-07-17)
1. **Helpdesk = QAI's own SHARED help center** — one agency-wide knowledge base for
   all users. **NOT per-client**, so **NO per-tool access toggle / no per-location
   content scoping** needed for the content. (Contrast: Review Boost is per-location.)
2. **Keep Notion sync** — Notion stays the authoring source for articles; port the
   Notion → Supabase importer (+ copying Notion media into Supabase Storage so links
   don't expire).
3. **AI → Anthropic Claude `claude-sonnet-4-5` with tool-use** — replace the old
   Lovable-Gateway + Google Gemini. Use **tool-use so Claude actually reads article
   BODIES** (e.g. `search_knowledge` / `get_article` tools), not just titles like the
   old one. Non-streaming + tool-use to extract structured output, per the project's
   standard AI rule. (Old one streamed; decide if the widget still needs streaming.)
4. **Add real admin login** — reuse the **Admin Portal auth pattern** (Supabase Auth,
   no public signup, `platform_admins` allowlist, `requireAdmin`-gated edge fns). The
   old Helpdesk had NO login and wide-open RLS — a real security hole; must be fixed.
5. **One widget, not two** — the old export has TWO drifted widgets (React
   `Embed.tsx`/`ChatWidget.tsx` and a vanilla `public/widget.js`). Build ONE.
6. **Drop the dead pgvector/embeddings scaffolding** — old `knowledge_entries.embedding`
   + `match_knowledge` RPC were never wired up. Don't port them (unless we deliberately
   choose embeddings for retrieval later).

## Open questions (decide when the rebuild starts)
- **Conversation attribution:** content is shared, but do we still tag each
  conversation with the GHL `location_id` (which sub-account the visitor came from) for
  analytics? Old version did. Likely yes (cheap, useful) — confirm.
- **Notion: keep or drop long-term?** Owner said keep for now. It's the heaviest,
  most fragile subsystem (~1000-line sync). Porting it is the biggest single effort.
- **Streaming chat** vs non-streaming (project standard is non-streaming). The widget
  UX may want streaming; decide.
- **Retrieval:** keyword search (old, title-only) → upgrade to Claude tool-use reading
  bodies (decided). Embeddings optional/later.
- **Where the widget lives in Playbook** (route/embed) + whether it shows the Playbook
  navbar (probably NOT — it's an embeddable widget/iframe, keep it chrome-less like
  the RB `/scan` page, which is outside `<Layout>`).

## Old-version facts (from read-only research, so we don't re-dig)
Product: an embeddable **AI support chat widget** ("Angel AI") — Guidelines/KB +
AI chat + Product Updates, in one panel; bilingual EN/中文; admin console at `/admin/*`.

- **Identity:** GHL `location_id` from the URL (`?location_id=`/`?locationId=` or a
  path segment), stashed on `document.body[data-location-id]`, sent to the backend.
  Used ONLY to tag conversations, not to scope content.
- **Old data model (Supabase, 32 migrations; pgvector enabled but unused):**
  - Conversations: `conversations` (visitor_id, status, channel, location_id),
    `messages` (conversation_id, role user|assistant|agent, content), `message_feedback`
    (👍/👎 per message, location_id), `support_analytics` (question/topic/ai_answered).
  - Knowledge: `knowledge_entries` (title, content markdown, category, source
    manual|notion, source_id, **embedding vector(1536) — unused**, folder_id,
    sort_order), `knowledge_folders`, `faq_entries`, `deleted_notion_entries` (tombstones).
  - Settings: `widget_settings` (branding), `notion_settings` (api_key, database_ids),
    `ghl_settings` (agency_id, auto_enable_future, enabled_location_ids).
  - `system_updates` (product-update posts). 3 public Storage buckets
    (`knowledge-images`, `widget-assets`, `update-images`). RPC `match_knowledge` (unused).
  - RLS was effectively WIDE OPEN (anon read/write on content; Notion key anon-readable).
- **Old edge functions (8):** `chat-support` (AI chat — Lovable Gateway +
  `google/gemini-3-flash-preview`; keyword-scores KB, feeds Claude/model only TITLES,
  streams SSE, logs analytics), `sync-notion` (~1000-line Notion importer + media→Storage),
  `fetch-notion-page` (single Notion page import), `ghl-list-locations` (lists agency
  sub-accounts via GHL LeadConnector API; no `ghl_locations` table — live-listed),
  `admin-support-data` (service-role admin data, gated by a spoofable origin allowlist),
  `manage-system-updates`, `upload-update-image`, `check-deployment-version`.
- **Old admin pages (7):** KnowledgeBase, Conversations, Analytics, HelpCenter (FAQ +
  updates), WidgetPreview, AdminSettings (branding + Notion), GoHighLevel (enroll subs).
- **Old secrets (names):** `LOVABLE_API_KEY` (drop after Claude swap), `NOTION_API_KEY`,
  `GHL_AGENCY_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_URL`, client
  `VITE_SUPABASE_*`. New: reuse `ANTHROPIC_API_KEY` (already a Playbook secret).

## Rules carried over (same as RB/Admin Portal)
- Commit + push after every phase (owner lost unpushed work once).
- Backend calls Claude `claude-sonnet-4-5`, tool-use, keys only in Supabase Edge
  secrets (owner sets them).
- Owner is non-technical: explain in Chinese, step by step, surface pros/cons for
  decisions, plan → confirm → build → verify in dev → commit+push.
