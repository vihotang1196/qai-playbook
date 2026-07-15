# QAI Review Boost — Progress

Rebuild of **Review Boost** (2nd migrated tool, after the copywriter), ported
from a Lovable export into this Vite + react-router app. All work is on branch
**`feat/review-boost`** (cut from `main`, NOT from `feat/copywriter` — the two
tools live on separate branches). Commit + push after every phase.

_Last updated: 2026-07-15 — Phase 4 done (Platforms page: per-location review-link config, scoped)._

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

**Data model — Option B (locked 2026-07-15):**
- `rb_platform_integrations` = the platform-config layer, **links only**: one row
  per (location_id, platform) with `review_url` + `is_enabled`. The sub-account
  enables a platform + pastes its link on the Platforms page.
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
- **Edge Functions (Deno):** `ghl` (customer identity — getLocation only) + `rb` (customer-scoped RB data, by location_id) + `sync-ghl-locations` (agency GHL sync) + `_shared/ghl.ts` (tool-neutral helpers)
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
- [ ] **Phase 5 — Campaigns.** Create/edit/list campaigns + short_code + thank-you (rich text).
- [ ] **Phase 6 — AI generation (Claude).** `generate-review` (preview + scan modes) + result modal.
- [ ] **Phase 7 — Scan flow.** `/scan/:code` + thank-you + platform tutorial (the core loop). ⭐
- [ ] **Phase 8 — QR / poster.** Printable poster + centered-logo QR, PNG export.
- [ ] **Phase 9 — Dashboard.** Scans / generations / posted-rate stats (recharts).
- [ ] **Phase 10 — Polish + merge.** Reconcile the `/tools` cards, merge to `main`.

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
- **Phase 6:** `ANTHROPIC_API_KEY` — already set for the copywriter; same project reuses it.
- **Phase 7 test:** a real business name/industry + a real Google/FB review link + a logo.

## Notes / dependencies

- **`/tools` hub dependency:** the `/tools` page + its cards live on
  `feat/copywriter` (not merged to `main`), so this branch has no `/tools` page.
  Review Boost is reachable directly at `/review-boost` for now; the 3rd `/tools`
  card is reconciled when both branches merge to `main` (Phase 10).
- Deps to add later: `@supabase/supabase-js` (P1), `qrcode.react` + `html-to-image` (P8),
  tiptap (P5, or a lighter textarea). recharts + react-query already installed.
- Original tech notes captured in the `review-boost-rebuild` memory.
