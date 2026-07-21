# QAI Helpdesk — Rebuild Progress

Rebuild of the **Helpdesk** (4th migrated tool) into this Playbook project,
ported from a Lovable export. **IN PROGRESS — P0–P7 done; P8 (product updates +
FAQ) next.**
This file records the owner's locked decisions, the old-version facts, and the
phased plan so a new session can pick up without re-researching.

_Last updated: 2026-07-20 — P0–P6 done, committed + pushed to `feat/helpdesk`
(working tree clean, nothing unpushed). **Notion sync fully working** (P4a–d):
manual DB list, batched / incremental / resumable / per-asset-fault-tolerant text
+ auto category folders (from section headings) + media (→ public helpdesk-media
bucket, permanent URLs) + tombstones (deleted articles don't resurrect). KB is
READ-ONLY (mirrors Notion). **P5 done:** AI chat (Angel AI) — Claude tool-use over
the KB, PLAIN TEXT (no vision, owner's final call), bilingual, cites the source
guide, never fabricates URLs. **Supabase = Pro** (100 GB; the full ~1200 articles
≈ 8 GB → fits). Owner does the full sync himself, one library at a time (manual DB
list). Other branches untouched: main f60158d, feat/admin-portal 755bee9 (RB +
Admin Portal — helpdesk was cut from here), feat/copywriter ffef217,
feat/review-boost 1d00e47 (frozen). **Next: P6 — the help-center PAGE (see the
refined P6 entry in the phased plan below)._

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
- [x] **P2 — Login + admin shell wired to live data (2026-07-18).** Helpdesk
  admin lives INSIDE the Admin Portal, reusing the ONE requireAdmin login. New
  dedicated `helpdesk-admin` edge fn (kept separate from the platform `admin` fn
  so that stays lean — mirrors how `rb` is separate; owner-approved structure):
  every action gated by `requireAdmin` before any service-role work,
  `verify_jwt=false` at the gateway. Ships `overview` — live counts (articles/
  folders/conversations/faq/updates) + Notion connection state (never returns the
  key). Files: `supabase/functions/helpdesk-admin/index.ts` + `config.toml`,
  `src/lib/helpdeskAdmin.ts` (session-authed client, same pattern as adminApi.ts),
  `src/pages/admin/helpdesk/Overview.tsx` (index page, count tiles + Notion card),
  `HelpdeskAdminShell` gained a 总览 tab. **Verified live:** deployed to hkqzz;
  with an admin session the Overview renders real counts (all 0 — empty tables) +
  "Notion 未连接"; anon key / garbage token / no-token all → 403 not_authorized;
  tsc clean; no console/server errors.
- [x] **P3 — Knowledge Base admin (2026-07-20).** Manual CRUD for folders +
  articles, all via the requireAdmin-gated `helpdesk-admin` fn (frontend never
  touches hd_ tables). Backend actions: listKnowledge / getArticle / saveArticle
  (insert=source 'manual'; update never rewrites source/source_id → Notion
  linkage survives) / deleteArticle / saveFolder / deleteFolder (FK SET NULL →
  articles just un-categorise). Frontend: shared `Markdown.tsx` (react-markdown +
  remark-gfm, no raw-HTML = XSS-safe; reused by the P6 widget), `Knowledge.tsx`
  (list + folder-filter chips + folder-mgmt dialog + delete confirm),
  `ArticleEdit.tsx` (full-page editor, markdown textarea + live preview).
  Registered `@tailwindcss/typography` for `prose`. Editor chosen by owner:
  markdown + live preview (not WYSIWYG). **Verified live** (admin session):
  create folder, create article w/ folder, live preview incl. GFM table, edit
  (loads body, updates in place), refresh persists, delete. **Bug found + fixed**
  (commit 2e6c318): Radix left a stuck full-screen overlay + body
  pointer-events:none after a dialog closed, freezing the page → both dialogs now
  conditionally MOUNTED (full unmount on close) + `releaseBodyPointerLock()`.
  Deps added: react-markdown, remark-gfm. Left one demo folder "入门指南" in the DB.
- **P4 — Notion sync ⭐ (biggest).** Split into sub-steps for the ~1200-article scale:
  - [x] **P4a — connect + discover (2026-07-20).** `helpdesk-admin`: `testNotion`
    (title + page count), `listNotionDatabases` (search all accessible DBs + counts,
    most-first). Settings page: DB-ID input + 测试连接 + 列出数据库. NOTION_API_KEY =
    Supabase secret (owner set). Found: corpus is ~1200 pages across ~33 untitled
    INLINE databases under "Q.AI Support Library".
  - [x] **P4b — manual DB list + batched TEXT sync + auto folders (2026-07-20).**
    Manual add/remove DB list (`hd_notion_settings.database_ids`); only added DBs
    sync. Migration: `hd_sync_queue` (per-page work-list) + `hd_articles.notion_last_edited`
    + `hd_sync_queue.folder_id`. `_shared/notion.ts`: one converter (retrying
    notionFetch, text-only, media→placeholder, depth-capped) + `folderNameForDatabase`
    (folder = the section HEADING of the DB's two-column layout — "Automation",
    "Payments", etc.). Actions: getNotionConfig / add / remove / planNotionSync
    (folder resolved once, re-folders skipped articles) / runNotionSyncBatch
    (per-page try/catch, uses stored folder_id) / getNotionSyncStatus. Settings UI:
    connected-DB list + per-DB sync + progress bar. **Verified live:** synced a
    19-page + a 4-page library — multi-batch progress, incremental re-sync skips
    unchanged, folders = "Expert - Start Setup Automation" (19) + "Webinar
    Templates" (4). 23 real articles imported.
  - [x] **P4c — media → Supabase Storage (2026-07-20).** Sync downloads each
    Notion-hosted image/video/file (expiring S3) → uploads to the new public
    `helpdesk-media` bucket (migration) → rewrites content to the permanent URL
    (external URLs kept as-is). `blocksToMarkdown` takes a `persist` callback;
    `persistMedia` in helpdesk-admin is idempotent (keyed by block id), 45MB
    capped, per-asset fault-tolerant (failure → placeholder, never fails the page).
    Images render inline; video-file links render as a `<video>` player
    (Markdown.tsx). `planNotionSync` gained `force` (backfill media into
    already-imported articles) + a 强制重新导入 checkbox; batch default 3 (media is
    slow). **Verified live:** force-resynced the 19-page library — the
    placeholder-only "Payment Success" article now has a real image (loads,
    1500×600) + video player, all Supabase URLs, 0 placeholders / 0 failed.
  - [x] **P4d — tombstones + read-only KB + polish (2026-07-20).** deleteArticle
    records a Notion article's source_id in `hd_deleted_notion_entries`;
    planNotionSync skips tombstoned pages ALWAYS (even force) → no resurrection.
    KB made READ-ONLY (owner: it mirrors Notion) — removed 新建文章 + per-row edit;
    rows open a read-only `ArticleView` (rendered md, image + `<video>`); kept
    delete; deleted ArticleEdit.tsx. Sync polish: persistent per-DB last-result +
    retry-via-resync; `getStorageUsage` action + 已用存储 readout in Settings.
    **Verified live:** deleted "Payment Success" → re-synced → stayed gone
    (skipped 19, 0 re-imported). Storage so far 157.8 MB / 38 files for 23
    articles (~6.9 MB/article → ~8 GB projected for the full ~1200).
    NOT DONE (owner's choice): full sync of all ~33 libraries — owner adds + syncs
    them one at a time (manual DB list). Optional later: un-tombstone UI.
- [x] **P5 — AI chat backend + test page (2026-07-20).** Public `helpdesk-chat`
  edge fn ("Angel AI"): Claude `claude-sonnet-4-5` tool-use loop (non-streaming) —
  `search_knowledge` (keyword ILIKE over title+body, JS-scored top 8) +
  `get_article` (full body, media stripped to markers). Plain-text Plan A (NO
  vision — owner's final call): finds the best guide, short step summary, points
  to the article for full images/video, answers only from the KB, same-language
  reply, never fabricates URLs (app renders source links). Returns
  {conversationId, answer, sources}; persists hd_conversations/messages + logs
  hd_support_analytics; location_id + channel tags. verify_jwt=false (widget
  reuses it). Frontend: `helpdeskChat.ts` + "AI 测试" admin tab/page
  (channel=admin-test). **Verified live:** EN + CN questions resolve to correct
  real guides, same-language, no invented URLs, sources link to the article; test
  page works in-browser. Files: `supabase/functions/helpdesk-chat/index.ts` +
  config.toml, `src/lib/helpdeskChat.ts`, `src/pages/admin/helpdesk/AiTest.tsx`,
  shell tab + route. PRE-LAUNCH TODO: public chat has no rate limit yet (like RB scan).
- [x] **P6 — The help-center PAGE (2026-07-20).** Customer help center at
  `/help`, coral-glass, mobile-first, THREE top tabs (defaults to AI 问答).
  **UPDATE 2026-07-21 (owner):** MOVED from OUTSIDE `<Layout>` to INSIDE it, so
  it now wears the Playbook navbar + footer and feels part of Playbook (same as
  the RB customer app — the "embed reversal" decision). HelpWidget renders no
  bg/chrome of its own now; it only adds `pt-24 md:pt-28` to clear the fixed
  navbar + a `max-w-3xl` container. Dropped its own lang toggle (the navbar has
  one). Chat tab uses a bounded `h-[68vh]` window (was full-viewport). The
  GHL-only gate is UNCHANGED (URL location_id; no location_id → block). Route
  moved into the Layout group in App.tsx. Verified: navbar + footer show, three
  tabs work, location_id gate holds, mobile no-overflow.
  **UPDATE 2026-07-21b (owner): navbar Helpdesk entry + tab-wide location_id
  persistence.** Added a "帮助中心 / Help Center" nav item between 首页 and DFY.
  Since the shared navbar navigates with plain <a> links that DROP the query
  string, a new `rememberLocationId`/`getStoredLocationId`/`resolveLocationId`
  (ghl.ts, sessionStorage `pb_location_id`, mirrors `rememberEmbed`) keeps the
  GHL location_id for the whole tab session: `<LocationIdKeeper>` in App.tsx
  stashes `?location_id=` on EVERY route, the navbar appends it to the Helpdesk
  link (withLocation flag), and useHelpLocation resolves URL→stored. So entering
  Playbook from GHL with a location_id and clicking Helpdesk keeps identity (was
  previously LOST → blocked). RB is untouched (still uses getLocationIdFromUrl /
  useLocationContext, URL/path-based). Verified in dev: home?location_id→stash;
  navbar 帮助中心 href carries the id; click → not blocked; direct /help with NO
  query but a stashed id → recovered (not blocked); cleared storage + bare /help
  → correctly blocked; RB still renders.
  **UPDATE 2026-07-21c (owner): navbar "小工具 / Tools" dropdown.** Product tools
  now live under a new "小工具" HoverCard dropdown (mirrors the existing "指南"
  one), desktop + mobile. Review Boost is the first entry; its link carries the
  location_id as a PATH (/review-boost/location/<id>) → straight to the customer
  view. Help Center stays a top-level nav item (support, always visible); the
  product tools group under 小工具. Copywriter joins this dropdown after the
  branches merge to main (P10). Verified: 小工具 dropdown shows Review Boost →
  /review-boost/location/test-verify-001 (id carried). Files: Navbar.tsx. New PUBLIC
  read fn `helpdesk` (verify_jwt=false, service-role internally, READ-ONLY:
  listFolders / listArticles / getArticle) — the frontend never touches the
  RLS-locked hd_ tables; the requireAdmin `helpdesk-admin` stays the only WRITE
  path. **① AI 问答** reuses `helpdesk-chat` (channel="widget" + location_id;
  visitorId persisted in localStorage); an answer's source guide opens that
  article IN-PAGE (switches to the browse tab). **② 浏览教程** = folders grouped
  (from `helpdesk` fn) + title search + read-only render via the shared
  `Markdown` component (images + `<video>` from permanent helpdesk-media URLs).
  **③ 产品更新** = placeholder (real content = P8). **Identity** REUSES RB's
  low-level helpers `getLocationIdFromUrl` + `fetchLocation` (lib/ghl) — NOT the
  RB `LocationProvider` (it's bound to RB's per-location `checkRbAccess`, which
  the agency-wide shared help center doesn't have). **Gate** = presence of a URL
  location_id (trust-the-URL, weak, like RB); no location_id → "请从 GHL 打开".
  Owner's refinement: content is NOT location-scoped, so the business-name
  resolution is best-effort (a transient `ghl` lookup failure must NOT lock a
  real GHL user out of help) — location_id only tags conversations for
  analytics. Files: `supabase/functions/helpdesk/index.ts` + config.toml,
  `src/lib/helpdesk.ts`, `src/pages/help/{HelpWidget,HelpChat,HelpBrowse,
  HelpUpdates}.tsx` (HelpWidget rewritten from the P0 stub; `/help` route
  already existed). **Verified live in dev** (deployed `helpdesk` to hkqzz):
  no location_id → gate page; `?location_id=…` → three tabs; AI answer + source
  link opens the article in-page; browse shows real folders (Dashboard 31 /
  Expert 18 / Webinar 4), search filters, an article renders a real image
  (1500px) + `<video>` from Supabase Storage; updates placeholder; bilingual
  toggle (帮助中心↔Help Center); mobile 375px has no horizontal overflow; tsc
  clean; no console errors. PRE-LAUNCH TODO: public reads + chat have no rate
  limit yet (same note as RB /scan + P5).
  **✅ FIXED (2026-07-20) — empty-answer-with-sources contradiction.** For
  screenshot-heavy guides the model used to read articles (so `sources`
  populate) but return NO final text → the old `answer || fallback` showed
  "抱歉…没找到相关内容" WHILE listing "相关指南: X, Y" below. Fix = A+B:
  **A (backend, helpdesk-chat, deployed to hkqzz):** system prompt now REQUIRES
  at least one sentence of text — if the model read a guide it must reply (even
  「这篇主要是图文步骤，打开《标题》看完整操作」), never stay silent; and the fallback is
  source-aware — the not-found message is used ONLY on a genuine miss (no
  article read); when article(s) were read but prose is empty it returns
  answer:"" + the sources (a placeholder is persisted for the record).
  **B (frontend, HelpChat.tsx + admin AiTest.tsx):** a guard renders a
  language-appropriate 「我找到几篇相关的指南 👇」 line instead of a blank/"not found"
  answer whenever sources exist. **Verified live in dev:** asking about the
  screenshot+video-heavy 《How to Setting Your WhatsApp Campaign (Non-official)》
  now returns a proper short CN answer naming the guide + saying it's mostly
  visual steps, with the source link — no more "没找到" contradiction.

  Original P6 spec (kept for reference):
  It is a **full help-center page** at `/help` (NOT a bottom-right popup widget),
  with THREE parts in one page:
  1. **AI 问答** — reuse the P5 `helpdesk-chat` fn (pass `location_id` + a
     `channel` like `"widget"`; NOT `admin-test`). Same bilingual, cite-the-guide,
     plain-text behavior. Source links open the article inside this page.
  2. **浏览知识库** — browse synced articles grouped by category folder; open one =
     read-only render (reuse the shared `Markdown` component; images + `<video>`
     show). Read from a PUBLIC read path (a public `helpdesk` fn action, or extend
     helpdesk-chat) — the frontend must NOT hit hd_ tables directly (RLS-locked).
  3. **产品更新** — placeholder / simple list for now (real content = P8; hd_updates).
  - **Restricted to GHL customers, like Review Boost:** entered via a GHL Custom
    Menu Link that carries `location_id` (trust-the-URL WEAK gate — the location_id
    is random + non-enumerable; NOT real auth). NO public navbar. No valid
    location_id → show a "请从 GHL 打开" message (mirror RB's no-location state).
  - **Reuse RB's identity logic — do NOT build a new one.** RB reads the URL
    location_id + embed handling in `src/lib/ghl.ts` + `src/hooks/useLocationContext.tsx`;
    reuse the same concept. (Note: `/help` is already routed OUTSIDE `<Layout>`,
    chrome-less, from P0 — HelpWidget.tsx is the placeholder to replace.)
  - **Layout:** OUTSIDE `<Layout>`, clean full-screen, coral-glass, mobile-first
    (embeds in a GHL iframe). On mobile the three parts are likely tabs; on desktop
    a sidebar (browse) + main (chat/article) is fine — decide at build.
  - Needs a PUBLIC KB read path for browse (list folders+articles, get one article
    incl. media URLs) — helpdesk-admin is requireAdmin-gated, so add public reads
    (new public `helpdesk` fn, or public actions on helpdesk-chat). Conversations
    are per-visitor (like the old version tagged by location_id for analytics).
- [x] **P7 — Conversations + analytics admin + 👍/👎 collection (2026-07-20).**
  Replaced the two admin stubs (`/admin/helpdesk/conversations` + `/analytics`)
  with real pages, all via the requireAdmin-gated `helpdesk-admin` fn. New
  actions: `listConversations` ({channel?, includeTest?, query?, limit}; excludes
  the internal `admin-test` channel by default; first user question + msg count
  from ONE batched query; business name via ghl_locations), `getConversation`
  (thread + its 👍/👎 feedback), `getSupportAnalytics` (standard dashboard —
  tiles [conversations / questions / AI-answered rate / visitors], 👍/👎 +
  好评率, 30-day question trend, channel breakdown, top Sub Accounts, top
  questions; cap-free COUNT for totals, capped aggregates for the rest with the
  same pre-scale note as RB/Admin stats). **👍/👎 collection (owner chose to
  build it in P7):** the PUBLIC widget answers now carry 👍/👎; a new public
  `feedback` action on `helpdesk-chat` upserts `hd_message_feedback` (idempotent
  per conversation+message_index, so toggling doesn't inflate counts). Feedback
  is collected ONLY on the real widget (NOT the admin AI-test page) so test
  clicks never pollute it. **Analytics stays clean of test noise WITHOUT a
  schema change:** `helpdesk-chat` now SKIPS the `hd_support_analytics` insert
  when channel==='admin-test' (conversations are still recorded + filterable).
  Files: `supabase/functions/helpdesk-admin/index.ts` (+3 actions) &
  `helpdesk-chat/index.ts` (feedback action + admin-test analytics skip),
  `src/lib/helpdeskAdmin.ts` (+3 fns/types) & `helpdeskChat.ts` (sendFeedback),
  `src/pages/help/HelpChat.tsx` (👍/👎 UI), `src/pages/admin/helpdesk/
  {Conversations,Analytics}.tsx` (new; stubs removed from sections.tsx),
  App.tsx routes. **Verified live in dev** (deployed helpdesk-admin +
  helpdesk-chat to hkqzz; owner's admin session was present in the preview
  browser): widget 👍→"谢谢反馈", write persists + idempotent toggle 👍↔👎 (no
  count inflation); Analytics shows conversations 5 / AI-answered 88% / 👍1 👎1
  好评率50% / trend / 按渠道=帮助中心 only (admin-test excluded ✓) / top questions;
  Conversations lists real threads (excl test, "含内部测试" toggle) → open one →
  full thread + the 👎 marker on the rated answer. tsc clean.
  NOTE: dev test data (location `test-verify-001`, questions like "feedback
  persistence check") is pre-launch noise in the analytics — safe to ignore.
  PRE-LAUNCH TODO: public feedback write has no rate limit (same note as chat).
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
