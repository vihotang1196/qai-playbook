# QAI Review Boost — Progress

Rebuild of **Review Boost** (2nd migrated tool, after the copywriter), ported
from a Lovable export into this Vite + react-router app. All work is on branch
**`feat/review-boost`** (cut from `main`, NOT from `feat/copywriter` — the two
tools live on separate branches). Commit + push after every phase.

_Last updated: after Phase 0 (scaffold + routes)._

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
- Tool-specific data lives in tool-owned tables (prefixed, e.g. `rb_campaigns`,
  `rb_qr_codes`) referencing `location_id`. The shared table stays lean.

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
- **Frontend:** `src/pages/review-boost/` (pages), `src/components/review-boost/` (components, TBD)
- **Edge Functions (Deno):** `supabase/functions/*` (TBD from Phase 1)

## Phased plan

- [x] **Phase 0 — Scaffold + routes.** All admin + public routes wired with
  coral-glass placeholder stubs. `/review-boost` landing hub links each section.
  Files: `src/pages/review-boost/{RBStub,Landing,pages}.tsx`, routes in `src/App.tsx`.
- [ ] **Phase 1 — DB + Auth.** Shared `ghl_locations` + tool tables (`rb_campaigns`,
  `rb_generations`, `rb_qr_codes`) + RLS + `increment_scan_count` RPC + email auth,
  in the Playbook Supabase project. Supabase client + generated types.
- [ ] **Phase 2 — Login + admin shell.** Auth page, useAuth guard, dashboard shell + sidebar, profiles.
- [ ] **Phase 3 — GHL sync.** Shared `sync-ghl-locations` function + `_shared/ghl.ts` + Sub-accounts page.
- [ ] **Phase 4 — Platforms.** Platform registry + per-location platform/link config.
- [ ] **Phase 5 — Campaigns.** Create/edit/list campaigns + short_code + thank-you (rich text).
- [ ] **Phase 6 — AI generation (Claude).** `generate-review` (preview + scan modes) + result modal.
- [ ] **Phase 7 — Scan flow.** `/scan/:code` + thank-you + platform tutorial (the core loop). ⭐
- [ ] **Phase 8 — QR / poster.** Printable poster + centered-logo QR, PNG export.
- [ ] **Phase 9 — Dashboard.** Scans / generations / posted-rate stats (recharts).
- [ ] **Phase 10 — Polish + merge.** Reconcile the `/tools` cards, merge to `main`.

## Owner to provide (when the phase needs it)

- **Phase 3:** GoHighLevel `GHL_AGENCY_API_KEY` + `GHL_COMPANY_ID` (Playbook Edge secrets).
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
