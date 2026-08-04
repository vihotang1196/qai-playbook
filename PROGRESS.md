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

## Retry / cost investigation, and the Sonnet 5 trial (2026-08-04)

**Symptom.** One customer click ran three Claude calls — 5m03s, roughly $0.30
instead of $0.10. Every attempt is metered before the model is called, so the
retries also consume quota: at three attempts per click the hourly cap of 15 is
really **5 generations an hour**, and the daily 40 is really 13. A throttled
customer reads that as the tool being broken.

**Ruled out by evidence, not by argument.**

- *Truncation.* The Anthropic console for 2026-07-29 showed 25,213 input and
  22,724 output tokens over 4 calls — about 5.7k output each, nowhere near the
  16000 `max_tokens` cap. Nothing was cut off.
- *"Server succeeded, client discarded it."* Zero duplicate `generation_result`
  rows, so no paid result was ever thrown away. (`recover` exists for exactly
  that case and was not being triggered.)
- *Upstream 429/503.* Each attempt ran 91–108s. A rate-limit refusal returns in
  under a second.

What is left is a malformed `tool_use` shape — a field declared as an array
arriving as a JSON string — which matches the Phase 1 finding that English funnel
output failed this way about two thirds of the time before the prompt was
tightened. It happens in Chinese too, not only English. Reproduced on
2026-08-04: attempt 1 failed `incomplete_output` in 74s, attempt 2 succeeded.

**Diagnostics added.** This function had no logging at all and never read the
response's `usage`, so a failure left no trace. A failed attempt now writes a
`generation_failed` row carrying `stopReason`, input/output tokens, HTTP status,
which field was missing, the reparse before/after shapes, and an `itemShape`
string that separates "the field never arrived" from "it arrived wrongly shaped".
Successful generations record their token spend on the `generation_result` row.
`requestId` is on the metering row too, so one click's retries can be grouped.
Neither `generation_failed` nor `generation_result` touches the quota or the admin
stats — both are filtered by `event_type` (see the note above).

**Silent-corruption bug found and fixed along the way.** Validation asked
`Array.isArray(funnel)` and whether `segments` was truthy. A shape like
`["Section one", "Section two"]` — a real array, wrong items — satisfied both,
was billed in full, and rendered as blank cards, because Results reads `.stage`
and `.section`/`.content` off each item. `[]` behaved the same way. Every item is
now required to be an object with a non-empty string at each key the UI reads.
This is independent of the model and stays regardless of which one is in use.
Expect the *observed* failure rate to look higher than before: generations that
used to slip through and render blank now fail loudly and retry. The spend was
always happening; it was just invisible.

**Sonnet 5 + strict schema: trialled, measured, rejected on tone.** `strict: true`
makes the API validate the tool input against the schema before returning, so the
malformed shape becomes impossible — but it is honoured only on Sonnet 5 /
Opus 4.8+ / Haiku 4.5. Measured on the same questionnaire, zh:

| | claude-sonnet-4-5 | claude-sonnet-5 + strict |
|---|---|---|
| Attempts per click | 3 (2 discarded) | **1** |
| Cost per click | ~$0.21 | **~$0.07** |
| Wall clock | 91–108s per attempt | **69s** |
| Caption emoji | 26 | 4 |
| Bullet-list icons | 21 | 1 |
| Trailing hashtags | 5 | 0 |

Better on every number, different in voice. The 📍/✔️ feature lists, the section
dividers and the hashtags disappeared and the scannable blocks became prose;
email bodies went from 6–7 emoji each to 0, 0 and 3. The pattern is consistent:
**countable instructions survived intact** (every "3 items" section still had
exactly 3; every "<=20 chars" bound held) **while every vague one was discounted
to its floor** — and the prompt asks for "适量 emoji" and "换行分段方便阅读"
rather than a number. **Owner chose the older model**: that formatting is what
this audience recognises, and prompt tuning was not worth risking it. The cost of
that choice — three attempts per click, 5 generations an hour — is accepted and
is written down beside `MODEL` and `COPY_LIMITS`.

Two claims from that trial that did **not** survive scrutiny, recorded so they
are not repeated as fact:

- *The Malaysian particles were never lost.* 2 in the old output, 4 in the new,
  both inside the 2–4 range that reads as natural. The prompt line naming
  "lah / boleh / shiok" needs no change.
- *The 30% length drop cannot be attributed to the model.* The 2026-07-29
  questionnaire was demonstrably richer — its output cites 8% SST, lunch, the
  post-course community and 91 seats, none of which were in the trial input. Only
  the emoji collapse is input-independent.

**To re-evaluate Sonnet 5 later**, change the one `MODEL` line back and restore
`strict: true` on `COPY_TOOL` plus `thinking: {type: "disabled"}` on the request
(Sonnet 5 thinks by default, and thinking tokens share the `max_tokens` budget
with the answer). The strict schema is already written and
`additionalProperties: false` is already on all eight objects — inert without
strict mode, required the moment it returns. Both parameters were *removed* rather
than left in place: whether claude-sonnet-4-5 rejects them or ignores them is
undocumented and was never tested.

**Still open.** Retry backoff — the loop retries immediately, so a genuine
upstream 429 is very likely to meet another one, and all three attempts consume
quota. Worth pairing with a reduction from 3 attempts to 2, but only after the
failure rate has been observed with the diagnostics in place.
