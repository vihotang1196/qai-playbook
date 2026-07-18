# QAI Helpdesk — Rebuild Progress

Rebuild of the **Helpdesk** (4th migrated tool) into this Playbook project,
ported from a Lovable export. **IN PROGRESS — P0 (scaffold) + P1 (DB) done.**
This file records the owner's locked decisions, the old-version facts, and the
phased plan so a new session can pick up without re-researching.

_Last updated: 2026-07-18 — branch cut; P0 (routes + placeholders) + P1 (hd_
schema) done, committed + pushed to `feat/helpdesk`. Next: P2 (login + shell)._

## Where to build it
- **Old version (read-only reference):** `C:\Users\chais\Projects\QAI Helpdesk`
  (a Lovable export; DO NOT edit it, DO NOT copy it into the Playbook repo). Same
  read-only-sibling pattern used for `QAI Review Boost`.
- **New branch:** ✅ `feat/helpdesk` cut from `feat/admin-portal` (2026-07-18) —
  that branch already has the reusable Admin Portal auth (requireAdmin + the
  `platform_admins` allowlist + the light admin shell), the shared `ghl_locations`
  + `tool_usage`, and the `_shared/*` Deno helpers.
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

## Open questions — RESOLVED by owner (2026-07-18)
1. **Conversation attribution:** ✅ YES — tag each conversation with the GHL
   `location_id` (analytics only, never scopes content). `hd_conversations`,
   `hd_message_feedback`, `hd_support_analytics` all carry a nullable, FK-free
   `location_id`.
2. **Streaming chat:** ✅ NON-streaming first (project standard; simple + stable).
   Upgrade to streaming later only if the widget UX needs it.
3. **Widget placement:** ✅ OUTSIDE `<Layout>`, chrome-less, full-screen — route
   `/help`, embeds as an iframe like the RB `/scan` page.
4. **Notion:** keep (owner). Heaviest/most fragile subsystem (~1000-line sync) —
   the biggest single phase (P4).
5. **Retrieval:** keyword (old, title-only) → Claude tool-use reading BODIES
   (decided). Embeddings optional/later (pgvector dropped in P1).

## Phased plan (owner-approved 2026-07-18)
Each phase is committed + pushed to `feat/helpdesk` when done.
- [x] **P0 — Scaffold (2026-07-18).** Cut branch. Public widget stub `/help`
  (chrome-less, OUTSIDE Layout). Helpdesk admin nested INSIDE the Admin Portal at
  `/admin/helpdesk/*` (reuses the ONE requireAdmin login + coral-glass chrome) via
  `HelpdeskAdminShell` sub-tabs: knowledge / conversations / analytics / updates /
  settings, each a placeholder. Added Helpdesk nav item (AdminLayout) + AdminHome
  card. `vite.config` honors `PORT` env + `launch.json` `autoPort` (coexist with
  another chat's dev server on 5180). Files: `src/pages/help/HelpWidget.tsx`,
  `src/components/helpdesk/HelpdeskAdminShell.tsx`, `src/pages/admin/helpdesk/
  sections.tsx`, routes in `src/App.tsx`, `AdminLayout.tsx`, `AdminHome.tsx`.
  **Verified in dev:** `/help` renders (no navbar); `/admin/helpdesk` → redirects
  to `/admin/login` when unauthenticated; `tsc --noEmit` clean; no console errors.
- [x] **P1 — DB (2026-07-18).** Migration `20260718120000_helpdesk_phase1.sql`
  (additive; dry-run → applied to hkqzz). 11 `hd_` tables (see table map below).
  Dropped pgvector (embedding col + match_knowledge never created). No
  ghl_settings. Every `hd_` table RLS ON + NO policy = service-role only.
  Singletons `hd_widget_settings` / `hd_notion_settings` seeded one row each.
  **Verified:** all 11 hd_ tables → anon `200 []` (RLS blocks even seeded rows, so
  the Notion key is NOT anon-readable); rb_*/ghl_locations/platform_admins/
  location_tool_access/admin_audit_log/tool_usage intact; knowledge_entries +
  match_knowledge → 404 (never introduced).
- [ ] **P2 — Login + admin shell.** Reuse `requireAdmin`; a `helpdesk-admin` edge
  fn (or extend `admin`) service-role-gated; wire the shell to real data. NEXT.
- [ ] **P3 — Knowledge Base admin.** Articles/folders CRUD (manual path first).
- [ ] **P4 — Notion sync ⭐ (biggest).** Port the ~1000-line importer + copy
  Notion media into Supabase Storage; tombstones via `hd_deleted_notion_entries`.
- [ ] **P5 — AI chat backend.** Claude `claude-sonnet-4-5` + tool-use
  (`search_knowledge` / `get_article` read BODIES), non-streaming.
- [ ] **P6 — The widget.** ONE unified embeddable widget at `/help`.
- [ ] **P7 — Conversations + analytics admin.**
- [ ] **P8 — Product updates + FAQ.**
- [ ] **P9 — Widget settings / branding + preview.**
- [ ] **P10 — Polish + merge** (`/tools` cards, merge to main).

### hd_ table map (old → new; built in P1)
`knowledge_folders`→`hd_folders` · `knowledge_entries`→`hd_articles` (no
embedding) · `conversations`→`hd_conversations` · `messages`→`hd_messages` ·
`message_feedback`→`hd_message_feedback` · `support_analytics`→
`hd_support_analytics` · `faq_entries`→`hd_faq` · `system_updates`→`hd_updates` ·
`widget_settings`→`hd_widget_settings` (singleton) · `notion_settings`→
`hd_notion_settings` (singleton, service-role only) · `deleted_notion_entries`→
`hd_deleted_notion_entries` · `ghl_settings`→(not ported).

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
