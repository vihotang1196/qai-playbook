# Playbook Admin Portal — Progress

The **platform-wide agency control center** for the whole Playbook: every tool's
"the operator needs to check + control customers" capability funnels into this
ONE authenticated back office. Designed tool-agnostic — new tools plug in via a
`tool_key`. First tools wired: **Review Boost** (copywriter deferred, see below).

Branch: **`feat/admin-portal`** (cut from `feat/review-boost`, so it has RB's code
to enforce access into). Shares the Playbook Supabase project (`hkqzzfyigmvisaftdmwh`).
Commit + push after every step.

_Last updated: 2026-07-17 — Step D done (shared tool_usage log + cross-tool /admin/stats). **All 4 steps (A–D) complete.**_

## Architecture principles (manage ALL tools)
- **Tool-agnostic:** every tool is a `tool_key` (`review_boost`, `copywriter`, future
  `offline_event`…). A code-level tool registry drives the access-toggle UI + stats.
  New tool = add a `tool_key` + write usage events → it shows up automatically.
- **Real login, server-enforced.** Never URL-secrecy. `/admin` is a guarded route
  group; every privileged action goes through an authenticated edge fn that runs
  `requireAdmin()` (validate session JWT → check `platform_admins` allowlist) BEFORE
  any service-role work. The frontend hiding a button is not the security.
- **Totally isolated from the customer app.** The customer app has zero admin
  capability (already true). `/admin` has its own dark chrome, shares nothing.

## Owner decisions (locked 2026-07-17)
- **Default tool access = ALLOW** (a location with no `location_tool_access` row =
  enabled). Admin toggles OFF to restrict. Keeps the 911 existing sub-accounts +
  demos working; can tighten to default-deny later.
- **RB first; copywriter deferred.** The copywriter is stateless + has no per-
  location identity (public direct-link tool, already live), so it can't be gated
  or metered per sub-account yet. It gets a placeholder in the tool registry;
  wiring it (add location identity + usage logging) is a later follow-up.
- **Stats = a shared `tool_usage` log table** (all tools write to it; the portal
  reads it uniformly). Future-proof + the basis for later credits/billing.
- **Branch = new `feat/admin-portal`** cut from `feat/review-boost`.

## New tables (ADDITIVE ONLY — never touch existing)
- `platform_admins` — login allowlist. (Step A ✅)
- `location_tool_access` (location_id, tool_key, enabled) — per (sub-account, tool). (Step B)
- `admin_audit_log` — who changed what. (Step B)
- `tool_usage` (tool_key, location_id, action, created_at, meta) — platform usage meter. (Step D)

## Steps (each testable + pushable)
- [x] **Step A — Auth foundation (2026-07-17).** Real login + guard + allowlist.
  - Migration `20260717120000_admin_portal_step_a_platform_admins.sql`: `platform_admins`
    (user_id → auth.users, unique; RLS ON with NO anon/authenticated policy → only the
    service role / admin edge fn can read it). Applied to hkqzz (dry-run→push).
  - `supabase/functions/_shared/admin.ts` `requireAdmin(req)`: reads the Bearer token,
    validates it via `auth.getUser(token)` (anon key resolves to no user → can't
    impersonate), then checks `platform_admins` with the service role. Returns the
    admin row or null.
  - `supabase/functions/admin/index.ts`: every action gated by requireAdmin; Step A
    exposes `whoami`. `verify_jwt=false` (requireAdmin is the real gate). Deployed.
  - Frontend: `src/lib/adminAuth.ts` (signIn/signOut/whoami), `src/pages/admin/AdminLogin.tsx`
    (email+password; a valid non-admin login is signed back out), `src/components/admin/
    AdminLayout.tsx` (guard: whoami on mount → not-admin bounces to /admin/login; dark
    shell + logout), `src/pages/admin/AdminHome.tsx` (welcome + placeholders). Routed in
    `src/App.tsx` OUTSIDE the customer Layout.
  - **Verified:** admin fn returns 403 `not_authorized` for the anon key + garbage tokens;
    anon REST read of `platform_admins` → [] (RLS); /admin/login renders; unauthenticated
    /admin redirects to /admin/login. **Not yet tested: a successful admin login** — needs
    the owner to configure Auth + create an account + seed the allowlist (below).
- [x] **Step B — Sub-accounts + per-tool access toggles + audit (2026-07-17).**
  - Migration `20260717140000_admin_portal_step_b_access_audit.sql`: `location_tool_access`
    (location_id, tool_key, enabled, updated_by; unique(location_id,tool_key)) +
    `admin_audit_log` (admin, action, target, tool, detail jsonb). Both RLS-on with
    NO anon/authenticated policy → service-role only. Applied to hkqzz.
  - `admin` edge fn actions (all after requireAdmin): `listLocations({query,limit})`
    (all ghl_locations + merged per-tool access; server-side search, default cap 50),
    `setToolAccess({location_id,tool_key,enabled})` (upsert + audit with from→to;
    default-allow = no row means enabled), `listAudit({limit})` (enriched w/ business
    names). Tool registry: `src/lib/admin/tools.ts` (ADMIN_TOOLS) + KNOWN_TOOLS set in
    the fn — add a tool in one place.
  - **Security fix:** `sync-ghl-locations` was PUBLIC (anyone with the anon key could
    trigger a full GHL sync) — now gated by requireAdmin + writes an audit row.
  - Frontend: `src/lib/adminApi.ts` (listLocations/setToolAccess/listAudit/syncLocations),
    `src/pages/admin/AdminSubAccounts.tsx` (search + "从 GHL 同步" + per-row RB toggle,
    copywriter shown as "即将", "打开" → the sub-account's RB view), `src/pages/admin/
    AdminAudit.tsx`; nav added to AdminLayout; AdminHome cards link through. Routes in App.tsx.
  - **Verified live (with a real admin session):** 911 sub-accounts list + search
    (911→1 on "Nutritionist"); toggled Ong pei shirl RB off → persisted on reload →
    audit showed "shaofeng@grandvisionx.com 把 Ong pei shirl 的 Review Boost 关闭了" →
    toggled back on. Anon → 403 on every admin action AND on sync; anon REST read of
    both new tables → []. Default-allow confirmed (no row = toggle shows on).
  - NOTE: owner's platform_admins.name is the placeholder "你的名字" — cosmetic, update
    the row's name anytime (email/audit are correct).
- [x] **Step C — Enforce access in RB (2026-07-17).** Owner chose A (block the
  WHOLE customer app, not just generation). Shared `supabase/functions/_shared/access.ts`
  `hasToolAccess(sb, location_id, tool_key)` — default-allow (no row / enabled=true →
  true; enabled=false → false). Enforced server-side:
  - `rb` fn: access gate right after the locationId check, BEFORE the switch → every
    action returns `tool_disabled` (403) when off. Added a cheap `access` probe action
    (returns {ok:true}, reached only when allowed) for the shell to call.
  - `generate-review`: gate in preview (by locationId), scan (by qr.location_id, before
    generating → no API burn), and regenerate (by the generation's location_id).
  - Frontend: `checkRbAccess(locationId)` in reviewBoost.ts (fail-open on transient —
    server still enforces); `useLocationContext` exposes `toolEnabled`; `AdminShell`
    renders a full-page "Review Boost 未对此 Sub Account 开放，请联系管理员" block
    (no sidebar/outlet) when disabled; ScanPage maps `tool_disabled` → "此活动暂不可用".
  - **Verified live:** portal toggled Ong pei shirl OFF → rb access/listCampaigns/scan
    all 403 `tool_disabled` (curl), RB admin showed the block page, scan page showed
    "此活动暂不可用" (no generation) → toggled ON → everything restored. Server-enforced
    regardless of the frontend.
  - NOTE: since the customer app is URL-identity, the admin's "打开" into a disabled
    Sub Account also shows the block — expected (manage access from the portal).
- [x] **Step D — Cross-tool stats (2026-07-17).** Owner chose: RB writes to a
  shared usage log + backfill existing RB data.
  - Migration `20260717160000_admin_portal_step_d_tool_usage.sql`: `tool_usage`
    (tool_key, location_id [nullable, NO FK — any tool can log], event_type,
    quantity, meta, created_at; RLS deny-all → service role only) + a ONE-TIME
    backfill from rb_generations (each row → a 'generation' event; posted rows also
    a 'posted' event). Applied to hkqzz.
  - Shared `_shared/usage.ts` `logToolUsage(sb, {tool_key, event_type, location_id,
    meta})` — best-effort, non-fatal. `generate-review` now logs: scan → 'generation',
    regenerate → 'generation' (AI cost), posted → 'posted' (only on the false→true flip).
  - `admin` fn `getUsageStats` (requireAdmin): headline totals via cap-free COUNT
    queries; by-tool / top-10 sub-accounts (谁用得多) / 30-day trend aggregated from
    recent rows (last 90d, capped 2000).
  - Frontend: `getUsageStats` in adminApi.ts; `src/pages/admin/AdminStats.tsx`
    (3 tiles + trend area chart + by-tool bars + top-N ranking); nav + AdminHome card
    + route.
  - **Verified live:** stats page shows backfilled totals (5 generations, 1 posted,
    2 active), by-tool (RB 5, copywriter 0 placeholder), ranking (AJ Demo 3 / Ong pei
    shirl 2), trend; a fresh scan pushed generations 5→6 live (write path works). Anon
    → 403 on getUsageStats; anon REST read of tool_usage → [] (RLS).
  - PRE-SCALE TODO: ranking/trend aggregate from capped rows (2000) in the fn — move
    to a SQL group-by RPC before high volume (same note as the RB dashboard trend).

**Admin Portal complete (A–D).** Copywriter still deferred (needs per-location
identity before it can be gated/metered — it appears in the tool registry + stats
as a placeholder).

**UI polish (2026-07-17):** Admin Portal restyled from dark → **light coral-glass**
(matches Playbook/RB): light ambient bg + glass-card panels + coral accents
(AdminLayout/Login/Home/SubAccounts/Stats/Audit). "Sub Account" wording kept here
(agency-facing). NOTE: the heavy sub-accounts page (911 rows + blur) can time out
the headless *screenshot* capture — the page itself renders fine (verify via
read_page). Also this session: RB client de-"Sub Account" + embed now shows the
Playbook navbar — see PROGRESS-REVIEW-BOOST.md notes.

## Owner to do (Step A go-live prerequisites)
1. Supabase dashboard → **Authentication → Providers → Email: enabled**; **Sign-ups:
   turn OFF "Allow new users to sign up"** (no public signup).
2. **Authentication → Users → Add user** (email + password) for each team member.
   (Account creation + passwords are the owner's to do — never handled in code.)
3. Send the team emails so the seed SQL can add them to `platform_admins` (run once
   in the SQL editor; it looks up auth.users by email and inserts allowlist rows).

## Security checklist (owner's rules — all met in Step A)
Real login ✓ · guarded /admin route ✓ · verify-admin-then-execute edge fn ✓ ·
customer app has zero admin capability ✓ · audit log (Step B).
