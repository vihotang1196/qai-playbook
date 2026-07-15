# QAI Copywriter — Progress

Rebuild of the "QAI 广告 & Funnel 文案生成器" (lost with an old unpushed Mac
branch), ported from the old TanStack Start project into this Vite +
react-router app. All work is on branch **`feat/copywriter`** (main = live
production site). Commit + push after every milestone.

_Last updated: after Phase C (voice clone verified)._

## Where things live

- **Branch:** `feat/copywriter` (not yet merged to `main`)
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

## Not done yet ⏳

- **Phase 4 — Visual polish** of the copywriter pages (final pass on the VisionOS coral-glass styling).
- **Merge `feat/copywriter` → `main`** once Phase 4 is done and verified. (Note: `main` already has the 13 Jul 2026 coaching replay; the merge won't conflict.)

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
