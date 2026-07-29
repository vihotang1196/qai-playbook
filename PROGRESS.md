# QAI Copywriter — Progress

Rebuild of the "QAI 广告 & Funnel 文案生成器" (lost with an old unpushed Mac
branch), ported from the old TanStack Start project into this Vite +
react-router app. All work is on branch **`feat/copywriter`** (main = live
production site). Commit + push after every milestone.

_Last updated: 2026-07-15 — merged to `main` + live on playbook.qiai.tech (Tools navbar entry hidden)._

## Where things live

- **Branch:** `feat/copywriter` — **merged to `main` on 2026-07-15 (fast-forward) and LIVE** on playbook.qiai.tech. Ongoing polish continues on this branch, re-merged when done.
- **Route:** `/copywriter`, reached from the `/tools` hub page; intentionally **not** in the navbar
- **Supabase project:** "Playbook", ref `hkqzzfyigmvisaftdmwh` (linked)
- **Frontend:**
  - `src/pages/Copywriter.tsx` — orchestrator (survey → loading → result)
  - `src/components/copywriter/Survey.tsx`, `Results.tsx`
  - `src/lib/copywriter/{i18n,types,api,pdf}.ts`
  - `src/lib/supabase.ts` — lazy client
  - `src/pages/Tools.tsx` — the /tools hub
- **Edge Functions (Deno):** `supabase/functions/generate-copy`, `supabase/functions/generate-voice`
- **PDF font:** `src/assets/fonts/NotoSansSC-Regular.otf` (Noto Sans SC, OFL) — CJK glyphs for the PDF
- **Env:** `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — gitignored; template in `.env.example`
- **Edge secrets (set by owner, never in repo):** `ANTHROPIC_API_KEY`, `MINIMAX_API_KEY`, `MINIMAX_GROUP_ID`, `MINIMAX_VOICE_ID_ZH` (owner's cloned voice), optional `MINIMAX_VOICE_ID_EN`/`_MS`

## Done ✅

- **Phase 0 — Frontend scaffold.** `/copywriter` inside the shared Layout, VisionOS coral-glass style. Survey (product/audience/painpoint/CTA/tone + output language 华文/English/Malay, its own selector + localStorage, independent of the site cn/en toggle) → loading → results (6 ad-script segments, ad caption, 9 funnel sections, WhatsApp+Email automation messages). Also added the `/tools` hub page + "小工具 / Tools" navbar item.
- **Phase 1 — AI generation (Claude).** `generate-copy` Edge Function calls the Claude Messages API (`claude-sonnet-4-5`, non-streaming). Uses **tool use / structured output** (not regex JSON) for reliability; prompts describe content only (telling the model to "emit JSON" caused malformed output). Client retries up to 3× on transient errors (each attempt is an independent request → avoids the ~150s Edge idle limit). Verified end-to-end in all three languages.
- **Phase 2 — Voice (MiniMax).** `generate-voice` Edge Function calls MiniMax `t2a_v2` (`speech-02-hd`, mp3, hex→base64). The 4 AIDA narration segments have "播放语音" buttons → inline `<audio>` player.
- **Phase C — Voice clone verified.** `MINIMAX_VOICE_ID_ZH` set to the owner's cloned voice; confirmed by the owner that it's their voice (machine-verified: valid distinct voice_id honored by MiniMax; owner ear-confirmed).
- **Phase 3 — PDF export.** `src/lib/copywriter/pdf.ts` (pdf-lib) builds a **real, selectable/copyable text-layer** PDF (NOT a rasterized image), styled to match the results page: title + subtitle, coral A/B/C/D circle markers, brand-color section titles, per-item rounded bordered cards with coral sub-headings. 华文 renders via the embedded CJK font (no tofu). Lazy-loaded so it doesn't bloat the main bundle.

## Deployed 🚀

- **Merged to `main` + live (2026-07-15).** Fast-forward merge, zero conflict — main's 13 Jul coaching replay was already in this branch's history (it was the merge base). Live on **playbook.qiai.tech**; owner confirmed on the live site.
- **Entry hidden on purpose.** The "小工具/Tools" navbar entry is commented out in `src/components/Navbar.tsx` (one line, shared by desktop + mobile) so the copywriter isn't publicly discoverable/abusable before GHL usage limits exist (each run costs Claude + MiniMax credits). The `/tools` + `/copywriter` routes stay deployed and reachable by **direct URL**. Re-enable that line (then let `main` redeploy) once GHL anti-abuse is in place.

## Not done yet ⏳

- **Phase 4 — Visual polish** of the copywriter pages (final VisionOS coral-glass pass). Merged un-polished on purpose — safe because the entry is hidden. Continue on `feat/copywriter`, re-merge to `main` when done.

## Branch state (2026-07-15)

- **`main`** = copywriter live + hidden (== `feat/copywriter` at the Navbar-hide merge).
- **`feat/copywriter`** = active copywriter branch; Phase 4 polish continues here.
- **`feat/review-boost`** = SEPARATE 2nd tool, branched from `main` (pre-merge). Phase 0 pushed; Phase 1 DB migration written, not yet applied. See `PROGRESS-REVIEW-BOOST.md` on that branch.

## Backlog / future 🗓️

- **GHL user system** (GoHighLevel integration):
  - Generation **history** per user
  - **WhatsApp copy generator** — free **10 uses**
  - **Admin Portal**
- **Migrate remaining pages** into this project: **Review Boost**, **Helpdesk**, **Offline Event** (currently not ported; kept out of the /tools cards / navbar until they exist).

## Ops notes

- Deploy a function: `npx supabase functions deploy <name>` (CLI installed as a devDependency → use `npx supabase`; owner is logged in on this machine).
- Secrets are read at function boot — after changing a secret, **redeploy** the function for it to take effect.
- Verify a PDF is copyable (not an image): `pdftotext file.pdf -` should return the text.
- **Known minor nit:** the PDF's CJK font renders the Latin "ff" ligature with a small gap (e.g. "Coffee" → "Co ee"); Chinese is perfect. Fixable later by using Helvetica for Latin runs in zh mode.

## Voice-over: all three languages confirmed usable (2026-07-29)

**Owner listened to all three and approved.** `MINIMAX_VOICE_ID_EN` and
`MINIMAX_VOICE_ID_MS` stay **unconfigured on purpose** — `generate-voice` falls
back to `MINIMAX_VOICE_ID_ZH` for any language without its own voice id, and the
owner judged the English and Malay output acceptable read by the Chinese voice.
**No separate voice ids needed; do not "fix" the fallback.**

Generated for the check via the deployed function, ~250–350 KB mp3 each.

### End-to-end run, same day

Full UI flow on the live edge functions, anonymous, with a real questionnaire
(盈利营销实战班 / RM 397 / Malaysian SME owners):

- Generation succeeded, **~130 s**, no errors. All five blocks rendered (AIDA ad
  script + top/bottom banners, ad caption, 9-section funnel, WhatsApp + email
  automation). Output was well localised — it used *lah* and *ponteng* naturally
  and carried the price, the 91-seat cap, and the stated pain point.
- Voice from the UI: ~13 s, `<audio>` mounted and autoplayed, 378 KB data URL.
- `tool_usage` metered correctly (`generation` ×1, `voice` ×N) and rate-limit
  counters incremented.
- Actual spend came in **under** the ~US$0.25 estimate — that figure assumes the
  full 16 000-token ceiling, and a real generation does not reach it.

> ⚠️ **The loading screen says "预计 20-40 秒" and the real time was 130 s.** A
> customer who refreshes at that point pays twice: `logToolUsage` meters *before*
> the Claude call, and the edge function runs to completion server-side after the
> browser disconnects. The questionnaire itself survives (localStorage draft), so
> the loss is money and quota, not re-typing.

### Rate limits are per event type — the two do not share a bucket

`generate-copy` passes `eventType: "generation"` and `generate-voice` passes
`eventType: "voice"` to `checkRateLimit`, and the admin usage overview filters on
`event_type` too. So generation (15/h, 40/day) and voice (40/h, 120/day) are
counted separately, and **a new `event_type` can be added to `tool_usage` without
disturbing either the limits or the admin stats.**
