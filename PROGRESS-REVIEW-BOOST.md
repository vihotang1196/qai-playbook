# QAI Review Boost — Progress

Rebuild of **Review Boost** (2nd migrated tool, after the copywriter), ported
from a Lovable export into this Vite + react-router app. All work is on branch
**`feat/review-boost`** (cut from `main`, NOT from `feat/copywriter` — the two
tools live on separate branches). Commit + push after every phase.

_Last updated: 2026-07-17 — Phase 8 done (QR poster: campaign-detail dialog, bilingual printable poster A4/table-tent/square + bare-QR, PNG export via html-to-image)._

## Scope (locked by owner)

- **Full white-label agency version** — keep GoHighLevel sub-account sync,
  multi-location, sub-accounts, credits. (NOT the simplified single-business MVP.)
- **With login** — Supabase Auth (email) protects the admin; the customer
  scan / thank-you pages stay public.
- **Reuse the existing "Playbook" Supabase project** (ref `hkqzzfyigmvisaftdmwh`,
  same one the copywriter uses) — add Review Boost tables there. No new project.
- **AI swapped to Claude** (`claude-sonnet-4-5`, tool use, non-streaming) — the
  original used the Lovable AI Gateway (Gemini). Matches the owner's rule.

## Shared-infrastructure principle (applies to Phase 1 & 3)

GHL identity (users/locations) is **platform-level shared infrastructure**, not
owned by any one tool. All tools (copywriter, Review Boost, future Offline Event)
share it:

- `GHL_AGENCY_API_KEY` + `GHL_COMPANY_ID` set **once** as Playbook Edge secrets;
  every function in the project reads them.
- One shared identity table (planned `ghl_locations`, tool-neutral: location_id,
  business_name, logo, niche, contacts, is_enabled, synced_at, user mapping).
- One shared sync function (`sync-ghl-locations`) — not one per tool.
- One shared Deno module `supabase/functions/_shared/ghl.ts` (sync + "resolve
  location/user for a request"). Tools `import` it.
- Tool-specific data lives in tool-owned tables (prefixed: `rb_platform_integrations`,
  `rb_campaigns`, `rb_qr_codes`, `rb_generations`) referencing `location_id`. The
  shared table stays lean.

**Terminology (locked 2026-07-15):** there is NO "store/门店" concept. The GHL
sub-account is the **子账号 (sub-account / location)**; under it are **平台
(platforms)** and **活动 (campaigns)**. Don't reintroduce "store".

**TWO-TIER ACCESS — privacy critical (corrected 2026-07-15, commit ca02982):**
- **Customer app** (the Review Boost admin, unauthenticated URL identity): a
  sub-account sees/manages ONLY its own platforms/campaigns/generations/stats.
  NEVER a sub-account list, another client's data, or any access toggle. Public
  `ghl` fn exposes only `getLocation` (own, PII-trimmed).
- **Admin Portal** (future, agency-only, behind REAL login): the god-view —
  list all sub-accounts, view anyone's data, toggle per-(location,tool) access,
  trigger sync. See the "Admin Portal (roadmap)" section below.
- Do NOT put any cross-client/agency capability in the customer app again.

**Data model — Option B (locked 2026-07-15; platform layer revised in Phase 5b):**
- `rb_platform_integrations` = the platform-config layer, **links only**. As of
  Phase 5b: **MANY rows per (location_id, platform)** (the `unique(location_id,
  platform)` constraint was dropped), each with `review_url` + an OPTIONAL `label`
  (a name the owner gives it, e.g. 美容院-总店). There is **no `is_enabled`
  toggle** — a link simply existing means it's usable. The sub-account adds/edits/
  deletes links on the Platforms page.
- `rb_campaigns` carries its **own business info** (business_name / industry /
  category / signature_features — "which business/product this campaign praises")
  + name / logo / thank_you_* / platform, and **references a platform config via
  `integration_id`** (→ which link to send customers to). No `review_url` on the
  campaign; no snapshot (link is resolved live so link edits propagate).
- So: 1 子账号 → many 平台配置 (one per platform) + many 活动 (each its own
  business, each pointing at one platform config for the link).

## What it is

Customer scans a QR → AI writes a real-feeling 5-star review on the spot →
auto-copied → one tap to Google / Facebook / Shopee to paste + post → thank-you
/ WhatsApp / redirect. Admin (agency) builds campaigns per location, gets a
QR / printable poster, tracks scans + generations.

## Where things live

- **Branch:** `feat/review-boost`
- **Read-only source (Lovable export):** `C:\Users\chais\Projects\QAI Review Boost`
- **Admin routes:** `/review-boost/*` (inside shared `<Layout>`)
- **Public routes:** `/scan/:code`, `/thank-you/:generationId` (OUTSIDE Layout, mobile full-screen)
- **Frontend:** `src/pages/review-boost/` (pages), `src/components/review-boost/` (AdminShell + AdminSidebar), `src/lib/{supabase,ghl}.ts`, `src/hooks/useLocationContext.tsx`
- **Edge Functions (Deno):** `ghl` (customer identity — getLocation only) + `rb` (customer-scoped RB data, by location_id) + `generate-review` (AI reviews via Claude; preview mode) + `sync-ghl-locations` (agency GHL sync) + `_shared/ghl.ts` (tool-neutral helpers)
- **Identity:** GHL passes `location_id` in the URL (path `/location/:id` or `?location_id=`); no email login

## Phased plan

- [x] **Phase 0 — Scaffold + routes.** All admin + public routes wired with
  coral-glass placeholder stubs. `/review-boost` landing hub links each section.
  Files: `src/pages/review-boost/{RBStub,Landing,pages}.tsx`, routes in `src/App.tsx`.
- [x] **Phase 1 — DB (applied + verified 2026-07-15).** Migration
  `supabase/migrations/20260715120000_review_boost_phase1.sql` pushed to the
  Playbook project with `npx supabase db push` (single migration; no history
  mismatch — first migration in the repo). Created shared `ghl_locations` +
  `rb_campaigns` / `rb_qr_codes` / `rb_generations` + `increment_scan_count`
  RPC + RLS (authenticated-manage; public /scan goes via the edge function's
  service role, which bypasses RLS). Verified: all 4 tables + RPC exist, and
  copywriter's `generate-copy` / `generate-voice` functions are untouched.
  **Done in Phase 2:** frontend `@supabase/supabase-js` client added. (Email
  auth NOT needed — identity comes from GHL; see Phase 2.)
- [x] **Phase 1b — platform layer + campaign fix (Option B, applied 2026-07-15).**
  Corrective migration `20260715140000_review_boost_phase1b_platforms.sql`: added
  `rb_platform_integrations` (links only, `unique(location_id, platform)`); on
  `rb_campaigns` added `integration_id` (→ platform config) and dropped
  `review_url` (business info STAYS on the campaign — Option B). Verified via REST:
  new table + `integration_id` present, `review_url` gone, business fields kept;
  copywriter functions untouched. Also renamed "门店/store" → 子账号/平台/活动
  across the RB UI + docs.
- [x] **Phase 2 — GHL identity + admin shell (2026-07-15).** Dropped email
  login/guard (the original's was vestigial). Identity = URL `location_id`
  (path `/location/:id` or query `?location_id=` — matches the Lovable original;
  GHL custom-menu-link iframe). Frontend: `src/lib/ghl.ts` (URL identity +
  `callGhl`), `useLocationContext` (resolves current location), `AdminShell` +
  `AdminSidebar` (coral-glass dashboard + top identity strip). Data access via
  the shared `ghl` edge function (service role; every query `.eq("location_id")`)
  — frontend never touches tables. `?embed=true`/`?ghl=true` hides the Playbook
  navbar (Layout.tsx) so only the RB shell shows inside GHL. Agency picker
  deferred to Phase 3 (needs synced locations). Verified in dev with a demo row
  (`demo-loc-001` "Demo Cafe"): sub-account view resolves name/logo, embed hides
  the navbar, agency root shows the placeholder. Added `@supabase/supabase-js`
  (Phase 1 leftover). Security: identity is still trust-the-URL (no SSO yet) —
  hardened later in one place (`_shared/ghl.ts` → `verifyGhlSso`).
- [x] **Phase 3 — GHL sync (2026-07-15).** Shared `sync-ghl-locations` edge fn
  (paginated `GET /locations/search` on services.leadconnectorhq.com, Bearer PIT
  from `GHL_AGENCY_API_KEY`, Version 2021-07-28) upserts into `ghl_locations`
  (preserves is_enabled). `ghl` fn gained `setEnabled`; `listLocations` returns
  all. SubAccounts page = the agency view: "Sync from GHL" button + list with
  enable/disable Switch + search (911 accounts, caps at 50 w/o a query) + "Open"
  → that sub-account's admin. Landing agency card links here. **Verified live:
  pulled 911 real sub-accounts, demo-loc-001 auto-deleted, picker → admin works.**
  NOTE: PIT is opaque (not a JWT) so companyId can't be auto-derived — owner set
  `GHL_COMPANY_ID` (the ~24-char Agency ID from Settings→Company, found via the
  `companyId=` param in the browser Network tab; NOT the Relationship Number).
- [x] **Phase 4 — Platforms (2026-07-15).** Sub-account's Platforms page
  (`/review-boost/location/:locationId/platforms`): 4 platforms (Google Maps /
  Facebook / Shopee / Custom) each with an enable toggle + review-link input +
  save → `rb_platform_integrations`. New customer-scoped `rb` edge fn (every
  action REQUIRES locationId and scopes `.eq("location_id", …)`; can only touch
  the caller's own location). Files: `supabase/functions/rb`, `src/lib/reviewBoost.ts`,
  `src/lib/review-boost/platforms.ts`, `src/pages/review-boost/LocationPlatforms.tsx`.
  Verified in dev: enable + paste + save Google Maps, refresh → persisted; a
  different locationId returns [] (no cross-location leak); no locationId → 400.
- [x] **Phase 5 — Campaigns (2026-07-15).** Sub-account create/edit/list
  campaigns, each with its OWN business info (business_name/industry/category/
  signature_features, fed to the AI) + name + logo URL + thank-you page + a
  chosen platform config (`integration_id`, from the enabled+linked platforms on
  the Platforms page). Creating a campaign auto-mints a unique 7-char
  `short_code` in `rb_qr_codes` → the scan URL `/scan/:code` (shown on the detail
  page w/ copy; QR image/poster is Phase 8). Detail page also lists the campaign's
  generation history (empty placeholder until Phase 7). Thank-you editor =
  **plain textarea** (owner chose over tiptap — line breaks + emoji, no rich
  text; upgradeable later). New `rb` fn actions: listCampaigns / getCampaign /
  saveCampaign / deleteCampaign / listGenerations — every one REQUIRES locationId
  and scopes `.eq("location_id")`; saveCampaign also validates `integration_id`
  belongs to the caller's own location. Files: `supabase/functions/rb` (extended),
  `src/lib/reviewBoost.ts` (campaign API), `src/pages/review-boost/{LocationCampaigns,
  LocationCampaignCreate,CampaignDetail}.tsx`, wired in `src/App.tsx`. **Also fixed
  embed stickiness** (`src/lib/ghl.ts` `rememberEmbed` + `sessionStorage`, called
  from `Layout.tsx`): `?embed=true`/`?ghl=true` is now remembered for the tab
  session so in-app navigation (which drops the query string) keeps the Playbook
  navbar hidden inside the GHL iframe. **Verified live** against two real
  sub-accounts: full backend cycle create→list→get→delete + isolation (sub-account
  B can't list/get/delete A's campaign) via the deployed fn; UI create (CJK+emoji
  ok) → detail (scan link `/scan/5exdsnj`) → B's campaigns empty; embed persists
  across navigation. DB unchanged (Phase 1/1b schema already had everything).
- [x] **Phase 5b — Platform links reworked (2026-07-17).** Owner-approved change
  (A/B/C/D): (1) removed the on/off toggle — a link existing = usable; (2) a
  platform can now hold MANY links, each with an OPTIONAL name/label (multiple
  branches, e.g. several Google pages); (3) the campaign "platform" picker is now
  a "pick a specific link" dropdown (grouped by platform, shows the link's name),
  storing that link's id in `integration_id`; (4) NO Google-API auto-detect —
  manual names instead. DB: additive migration
  `20260715160000_review_boost_phase5b_platform_links.sql` on `rb_platform_integrations`
  ONLY — drops the `unique(location_id, platform)` constraint (by looking it up,
  name-agnostic), adds `label text`, drops `is_enabled`. Dry-run→applied to hkqzz;
  copywriter (generate-copy/voice) verified untouched; existing link + campaign
  preserved (the campaign→link FK references the link's PK id, unaffected). `rb` fn:
  `listPlatforms` (label, no is_enabled), `savePlatformLink` (insert new / edit by
  id), `deletePlatformLink` (by id); `getCampaign`/`listCampaigns` now embed the
  linked `integration` (id/platform/label/review_url) so the detail page shows
  "→ Google Maps · 美容院-总店". Files: migration, `supabase/functions/rb/index.ts`,
  `src/lib/reviewBoost.ts` (RBPlatformLink + campaign.integration), `src/pages/
  review-boost/{LocationPlatforms,LocationCampaignCreate,CampaignDetail}.tsx`.
  **Verified live** vs real sub-account A: 2 named Google links persist, picker
  lists both, campaign detail shows the target link, isolation holds, thank-you
  message saves correctly. Demo left on A: 2 links + 1 campaign "母亲节好评 · 总店".
- [x] **Phase 6 — AI generation (Claude) (2026-07-17).** New `generate-review`
  edge fn calls the Claude Messages API (`claude-sonnet-4-5`, tool-use for
  structured JSON via a `write_reviews` tool, non-streaming, `temperature: 1`).
  ANTHROPIC_API_KEY reused from the copywriter (already a Playbook Edge secret).
  **`preview` mode** (shipped): REQUIRES locationId + campaignId, verifies the
  campaign belongs to that location (own-data only), feeds the campaign's business
  info (business_name/industry/category/signature_features + platform) to Claude,
  returns N sample reviews (count clamped 1–5), writes NOTHING to the DB.
  **`scan` mode** = Phase 7 (public by short_code, saves rb_generations) — stubbed,
  returns 400 for now. Realism techniques (owner chose 拟真): random persona per
  review, varied length/tone, name 1–2 specific features, local casual language,
  avoid AI tells, occasional emoji. Language (owner chose default-cn-switchable):
  a per-call `language` param cn/en/ms — each hint names the DOMINANT language so
  switching actually switches (the business info is Chinese, so it drifts
  Chinese-heavy without this). NO schema change. Frontend: `previewReviews()` in
  `src/lib/reviewBoost.ts` (3 retries, each an independent Claude call); campaign
  detail page has a "试生成" button → dialog with a cn/en/ms switch, 3 samples
  (persona pill + copy each), and 再写一批 (regenerate). Files: `supabase/functions/
  generate-review`, `supabase/config.toml` (verify_jwt=false), `src/lib/reviewBoost.ts`,
  `src/pages/review-boost/CampaignDetail.tsx`. **Verified live** vs real campaign:
  cn/en/ms all produce natural, human-sounding persona-varied reviews; isolation
  holds (other location → 404); missing campaignId → 400.
- [x] **Phase 7 — Scan flow (2026-07-17) ⭐.** The core customer loop, live.
  Public pages (OUTSIDE Layout, mobile-first coral-glass, own background):
  `ScanPage` (`/scan/:code`) + `ThankYouPage` (`/thank-you/:generationId`).
  `generate-review` gained 4 PUBLIC modes: **scan** (resolve QR by short_code +
  is_active, generate 1 review, save rb_generations, bump scan_count via RPC,
  return the campaign's linked platform URL via integration_id) · **regenerate**
  (owner chose precise counting: UPDATE the same row in place — no new row, no
  scan_count bump; anti-tamper = generation must belong to the code; only for a
  row <60min old) · **posted** (set posted=true — the posted-rate signal) ·
  **thankyou** (campaign thank-you content by generationId). **Abuse (owner chose
  per-QR limiting, NO new table/IP):** per-QR caps counted from existing
  rb_generations rows — hourly 60, daily 300; over → friendly "rate_limited";
  plus the existing is_active kill-switch. **Language (owner chose default-cn +
  customer switch):** scan page has a cn/en/ms switch that regenerates in that
  language (client cap 3 regens/page). Flow: scan → review shown first (auto-copy
  best-effort; the reliable copy is the button gesture — mobile clipboard rule) →
  "复制好评并前往 {平台}" opens the review link in a new tab (same-tab fallback if
  popup-blocked) → paste+post → "我发了" (enabled only after opening the link) →
  posted=true → url-mode redirects to redirect_url (WhatsApp = a wa.me link),
  else → thank-you page. Files: `supabase/functions/generate-review` (extended),
  `src/lib/reviewBoost.ts` (scanReview/regenerateReview/markPosted/getThankYou),
  `src/pages/review-boost/{ScanPage,ThankYouPage}.tsx`, wired in `src/App.tsx`.
  NO schema change (rate limit uses rb_generations; DB already had everything).
  **Verified live** vs a real campaign: scan generates+saves+counts (scan_count
  0→1), regenerate updates in place (count stays 1), posted + thankyou work,
  cn/en/ms switch works in the UI, inactive code → friendly error, tamper → 404.
  **Residual (noted):** regenerate is bounded by client cap + anti-tamper + 60-min
  window + the shared hourly cap, but a scripted attacker could still regenerate a
  recent row repeatedly — a 1-column `regen_count` on rb_generations would fully
  lock it server-side (deferred; per-review cost is tiny + kill-switch exists).
- [x] **Phase 8 — QR / poster (2026-07-17).** Pure frontend (no backend/DB/edge
  change); added deps `qrcode.react` + `html-to-image`. Campaign-detail page has a
  "生成二维码海报" button → `PosterDialog`. Owner chose: **full poster** (business
  name + ★★★★★ + centered-logo QR + platform badge + optional free-text promo
  pill) · **bilingual 华文+English** · **3 sizes** (A4 / table-tent 4×6 / social
  square). Plus a "download bare QR PNG" button always. QR encodes
  `${window.location.origin}/scan/{short_code}` — **must be generated on the live
  site** so it points at production, not localhost (noted in the dialog).
  Export = `html-to-image` `toPng` at per-size pixelRatio (A4 4×) → downloaded via
  an anchor; `fontEmbedCSS: ""` + `skipFonts` so it never reads the app's
  cross-origin Google Fonts sheet (poster uses a system font stack; CJK renders
  fine). Files: `src/components/review-boost/QrWithLogo.tsx` (QRCodeSVG level H +
  centered logo), `src/lib/review-boost/poster.ts` (per-platform specs + sizes),
  `src/components/review-boost/PosterDialog.tsx`, wired in `CampaignDetail.tsx`.
  **Verified live**: dialog renders the bilingual poster w/ business name +
  scannable QR, size switch + promo work, `toPng` returns a valid PNG (data:image/
  png; ~250KB@1×) with zero console errors. iOS note added (may open image →
  long-press to save).
- [ ] **Phase 9 — Dashboard.** Scans / generations / posted-rate stats (recharts).
- [ ] **Phase 10 — Polish + merge.** Reconcile the `/tools` cards, merge to `main`.

## Pre-launch hardening TODO (do BEFORE going public, NOT now)

Recorded 2026-07-17; **do not build yet.**
- **Scan-page "regenerate" abuse hardening.** Today regenerate is bounded by a
  client cap (3/page) + anti-tamper (generation must belong to the code) + a
  60-min row-age window + the shared per-QR hourly cap — but those hourly/daily
  caps count `rb_generations` ROWS (inserts), and regenerate UPDATES in place, so
  a script pointed at one recent generationId could still burn a bit of Claude
  spend. Before the QR codes are truly public to the crowd, add a `regen_count`
  smallint on `rb_generations` (additive migration, our own table) and cap
  regenerates per row server-side to fully lock it. Deferred now because per-review
  cost is tiny and the owner has the `rb_qr_codes.is_active` kill-switch.

## Launch TODO — embed the whole Playbook in GHL (do at GO-LIVE, NOT now)

Recorded 2026-07-15; **do not build yet.** Cross-cutting (whole Playbook, not
just Review Boost). When ALL tools are done + merged to `main` + live:
- Embed the whole Playbook into the **GHL sidebar via a Custom Menu Link** (NOT
  a Marketplace App): GHL admin → add a Custom Menu Link whose iframe points at
  `playbook.qiai.tech`. Users click it from the GHL sidebar and land on the
  Playbook home (the community / product portal); tools are reached from there.
- **Whether to append `?location_id={{location.id}}`:** decide once all tools
  are built — pass it only if the tools need to identify the sub-account.
- **Prerequisite:** all tool features finished + merged to `main` + deployed first.
- Reference: NurtureOS is embedded the same way (Custom Menu Link, no App).

## Final customer scan flow (LOCKED — build this in Phase 7)

Confirmed with the owner 2026-07-15. Each `rb_campaigns` row is a **completely
independent** business/product (Campaign A = Company A selling food, Campaign B =
Company B selling electronics — each with its own info + review link). The AI
learns THAT campaign's business info and writes a praising 5-star review for it.
One sub-account can hold many such unrelated campaigns/QRs.

1. Customer scans the QR → `/scan/:code` (public, mobile, no site navbar).
2. Page generates + shows the AI 5-star review (first thing they see).
3. Review is auto-copied to the clipboard — best-effort on load, and reliably
   again on the "Continue" click (mobile browsers only allow clipboard writes on
   a user gesture, so the click-copy is the one that counts). **KEPT.**
4. Button "Copy review & continue to {Platform}" → opens the campaign's
   configured `review_url` (Google / Facebook / Shopee / custom) in a new tab.
5. Customer pastes + posts the review there (with their own account).
6. Button "I've posted it!" → sets `rb_generations.posted = true` (**the data
   source for the posted-rate stat — KEPT**) → redirects to thank-you / WhatsApp
   / the campaign's `redirect_url`.

DB already supports this: `rb_qr_codes.scan_count` (scans) + `rb_generations.posted`
(posted-rate). No schema change needed for Phase 7.

## Admin Portal (roadmap — separate dedicated phase, NOT now)

The agency god-view. Highest privilege (all clients' data + access control), so
it needs REAL auth — never URL secrecy. Planned design:
- **Auth:** Supabase Auth (email+password / magic link). **Public signup OFF** —
  admin accounts created by the owner only. Session JWT, server-verified.
- **Authorization:** an allowlist table (`rb_admins` or shared `platform_admins`)
  keyed by `auth.uid()`. Every god-op runs in an **authenticated** edge function
  that verifies the caller is an admin before using the service role. Never trust
  the frontend; RLS denies anon.
- **Separation:** a distinct guarded route group (e.g. `/admin`), redirecting to
  a login page if unauthenticated. Zero god-view code in the customer app.
- **Per-tool access matrix:** shared `location_tool_access(location_id, tool,
  enabled)` (cross-tool infra, like ghl_locations) — the portal toggles it; each
  tool checks its own access. Replaces the single global `ghl_locations.is_enabled`.
- **Audit log** of access changes.
- Reuses `_shared/ghl.ts` (listLocations / setLocationEnabled / syncGhlLocations)
  via the authenticated admin function.

## Owner to provide (when the phase needs it)

- **Phase 3:** ✅ done — `GHL_AGENCY_API_KEY` (PIT) + `GHL_COMPANY_ID` (Agency ID) set as Playbook Edge secrets.
- **Phase 6:** ✅ done — `ANTHROPIC_API_KEY` reused (already a Playbook Edge secret from the copywriter; confirmed present 2026-07-17).
- **Phase 7 test:** ✅ done — verified vs the demo campaign (Ong pei shirl / 妈妈美容院, Google link 美容院-总店). A real logo is still nice-to-have for polish.

## Notes / dependencies

- **`/tools` hub dependency:** the `/tools` page + its cards live on
  `feat/copywriter` (not merged to `main`), so this branch has no `/tools` page.
  Review Boost is reachable directly at `/review-boost` for now; the 3rd `/tools`
  card is reconciled when both branches merge to `main` (Phase 10).
- Deps: `@supabase/supabase-js` added (P1); `qrcode.react` + `html-to-image` added
  (P8). Phase 5 thank-you uses a plain textarea (owner chose over tiptap — NO new
  dep). recharts + react-query already installed (recharts for the P9 dashboard).
- Original tech notes captured in the `review-boost-rebuild` memory.
