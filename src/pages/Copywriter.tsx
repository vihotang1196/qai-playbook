import { useEffect, useState } from "react";
import { Loader2, Sparkles, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Survey, hasDraftContent, writeDraft } from "@/components/copywriter/Survey";
import { Results } from "@/components/copywriter/Results";
import { History } from "@/components/copywriter/History";
import OpenFromQai from "@/components/OpenFromQai";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { generateCopy, getHistoryItem, recoverCopy } from "@/lib/copywriter/api";
import { resolveLocationId } from "@/lib/ghl";
import { useLang } from "@/i18n/LanguageContext";
import { T, type Language, saveLang, uiLanguage } from "@/lib/copywriter/i18n";
import type { GenerateResult, HistoryDetail, SurveyInput } from "@/lib/copywriter/types";

type Stage = "survey" | "loading" | "result" | "history" | "historyDetail";

/**
 * In-flight marker for a generation this browser started.
 *
 * The expensive moment is not "customer comes back tomorrow" — recovery already
 * covers that. It is the customer who refreshes at 60 seconds, lands on a blank
 * questionnaire, assumes it broke, and hits Generate again. The first run is
 * still executing and still billable; the second one doubles the cost for one
 * piece of copy. This marker is what stops the page from looking like nothing
 * ever happened.
 *
 * Deliberately localStorage, not React state: its whole job is to outlive the
 * page. Cleared on success AND on definite failure — a marker left behind after
 * a real error would block the retry the customer is entitled to.
 */
const INFLIGHT_KEY = "qai_copy_inflight";
/** Past this, treat the attempt as lost and let the customer start over. Real
 *  runs land around 2 minutes; this leaves generous headroom without stranding
 *  anyone behind a disabled button forever. */
const INFLIGHT_TTL_MS = 4 * 60_000;

type Inflight = { requestId: string; startedAt: number };

function readInflight(): Inflight | null {
  try {
    const raw = localStorage.getItem(INFLIGHT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Inflight;
    if (!v?.requestId || typeof v.startedAt !== "number") return null;
    if (Date.now() - v.startedAt > INFLIGHT_TTL_MS) {
      localStorage.removeItem(INFLIGHT_KEY);
      return null;
    }
    return v;
  } catch {
    return null;
  }
}

const writeInflight = (v: Inflight) => {
  try {
    localStorage.setItem(INFLIGHT_KEY, JSON.stringify(v));
  } catch { /* private mode — the guard is a courtesy, not a gate */ }
};

const clearInflight = () => {
  try {
    localStorage.removeItem(INFLIGHT_KEY);
  } catch { /* see above */ }
};

/**
 * QAI Ad & Funnel Copy Generator — self-contained mini-app on /copywriter.
 *
 * Manages its own output language (zh/en/ms via the survey), independent of the
 * site-wide cn/en toggle. Sits inside the shared <Layout> (background + Navbar +
 * Footer), so this page only renders its own content under a fixed navbar.
 *
 * Generation calls the `generate-copy` Supabase Edge Function (Claude).
 * Voice (Phase 2) and PDF export (Phase 3) are still stubbed in Results.
 */
const Copywriter = () => {
  const [stage, setStage] = useState<Stage>("survey");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [lastInput, setLastInput] = useState<SurveyInput | null>(null);
  // Identity = the GHL location_id in the URL (same trust-the-URL posture as
  // Helpdesk / Review Boost / Offline Event). Generation costs real money, so
  // without an identity the tool must not run at all — the server enforces the
  // same rule; this gate just avoids a pointless round-trip and explains why.
  const { lang: uiLang } = useLang();
  const [locationId] = useState<string>(() => resolveLocationId());

  // A generation this browser started and never saw finish, if there is one.
  const [inflight, setInflight] = useState<Inflight | null>(() => readInflight());
  const [checking, setChecking] = useState(false);

  // ── History ──────────────────────────────────────────────────────────────
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  /** A template waiting on "this will overwrite your draft" confirmation.
   *  Non-null ONLY when the draft actually holds typed content. */
  const [pendingTemplate, setPendingTemplate] = useState<SurveyInput | null>(null);

  /** Open one entry. Switches view first so the tap gets an immediate response,
   *  then fills it in — a list that sits still for a second reads as broken. */
  const openDetail = async (id: string) => {
    setDetail(null);
    setDetailLoading(true);
    setStage("historyDetail");
    try {
      const item = await getHistoryItem(locationId, id);
      if (!item) {
        toast.message(uiLang === "cn" ? "这条记录已不存在" : "That entry is no longer available");
        setStage("history");
        return;
      }
      setDetail(item);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open this entry");
      setStage("history");
    } finally {
      setDetailLoading(false);
    }
  };

  /** Put a past questionnaire back in the form. Writes the DRAFT and switches to
   *  the survey — it never starts a generation, because that would be spending
   *  the customer's money on a click that only said "let me edit this". */
  const applyTemplate = (input: SurveyInput) => {
    writeDraft(input);
    // Keep the standalone output-language memo in step with the draft, or the
    // form would restore the template's answers under the previous language.
    if (input.language) saveLang(input.language);
    setDetail(null);
    setStage("survey");
    toast.success(
      uiLang === "cn" ? "已载入表单，请检查后再点生成" : "Loaded into the form — review it before generating",
    );
  };

  /** "Use as template" — asks first, but only when there is something to lose. */
  const requestTemplate = () => {
    const input = detail?.input;
    if (!input) return; // button is disabled in this case; belt and braces
    if (hasDraftContent()) {
      setPendingTemplate(input);
      return;
    }
    applyTemplate(input);
  };

  // Expire the marker on its own so the disabled Generate button can never
  // become permanent — the customer gets the questionnaire back at the TTL
  // whether or not anything is polling.
  useEffect(() => {
    if (!inflight) return;
    const left = INFLIGHT_TTL_MS - (Date.now() - inflight.startedAt);
    if (left <= 0) {
      clearInflight();
      setInflight(null);
      return;
    }
    const id = setTimeout(() => {
      clearInflight();
      setInflight(null);
    }, left);
    return () => clearTimeout(id);
  }, [inflight]);

  const run = async (input: SurveyInput) => {
    const requestId =
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // Marked BEFORE the call, not after: the whole point is to survive a reload
    // that happens while the request is still in the air.
    writeInflight({ requestId, startedAt: Date.now() });
    setInflight({ requestId, startedAt: Date.now() });
    setLastInput(input);
    setStage("loading");
    try {
      const r = await generateCopy(input, locationId, requestId);
      clearInflight();
      setInflight(null);
      setResult(r);
      setStage("result");
    } catch (e) {
      // A definite failure releases the marker — the customer is owed a retry.
      // (A reload never reaches this branch, which is exactly why the marker
      // outlives it.)
      clearInflight();
      setInflight(null);
      const msg = e instanceof Error ? e.message : "Generation failed";
      toast.error(msg);
      setStage("survey");
    }
  };

  /** Collect a finished generation. Shared by the poll and the button; only the
   *  button says anything when the answer is "not yet". */
  const collect = async (announceEmpty: boolean) => {
    if (!inflight) return;
    const r = await recoverCopy(locationId, inflight.requestId);
    if (r) {
      clearInflight();
      setInflight(null);
      setResult(r);
      setLastInput((prev) => prev ?? ({ language: r.language } as SurveyInput));
      setStage("result");
      toast.success(uiLang === "cn" ? "已找回上次生成的文案" : "Recovered your last generation");
      return;
    }
    if (announceEmpty) {
      toast.message(
        uiLang === "cn" ? "还没生成好，请再等一下" : "Not ready yet — give it a little longer",
      );
    }
  };

  // Poll while a generation is unaccounted for. The manual button alone is not
  // enough: someone who checks at 60s, is told "not ready", and walks away never
  // comes back to press it again — and the result they paid for then sits in the
  // table unclaimed, which is the exact failure this whole feature exists to
  // prevent. Cheap enough to justify: one indexed read, not a Claude call.
  //
  // Paused while the tab is hidden — a backgrounded tab polling every 15s is
  // load nobody asked for, and there is no one there to see the result anyway.
  // Resumes on the way back, and checks immediately rather than waiting out
  // another interval, since returning to the tab is precisely when the customer
  // is looking. Stops on result, on TTL, and on unmount.
  useEffect(() => {
    if (!inflight) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      void collect(false);
    };
    const start = () => {
      if (timer) return;
      timer = setInterval(tick, 15_000);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        tick();
        start();
      }
    };

    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // Re-armed whenever the marker changes (new attempt / cleared).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inflight?.requestId]);

  /** "Check result" — the manual nudge, for people who don't want to wait 15s. */
  const checkInflight = async () => {
    if (!inflight || checking) return;
    setChecking(true);
    try {
      await collect(true);
    } finally {
      setChecking(false);
    }
  };

  // The waiting screen is interface text, so it follows the navbar — not the
  // output language the customer picked for the copy.
  const lang: Language = uiLanguage(uiLang);

  if (!locationId) {
    return (
      <OpenFromQai
        lang={uiLang}
        icon={PenLine}
        title={{ cn: "文案生成器", en: "Copy Generator" }}
        description={{
          cn: "请从你的 QAI 后台打开文案生成器，这样才能识别你的账号。",
          en: "Please open the Copy Generator from your QAI dashboard so we can recognise your account.",
        }}
      />
    );
  }

  return (
    <main className="pt-20 pb-12">
      {/* The reload landing pad. Without this the customer sees a blank
          questionnaire and reasonably concludes it failed — then pays a second
          time for copy the first run is still producing. */}
      {stage === "survey" && inflight && (
        <InflightNotice
          uiLang={uiLang}
          startedAt={inflight.startedAt}
          checking={checking}
          onCheck={checkInflight}
        />
      )}
      {stage === "survey" && (
        <Survey
          onSubmit={run}
          disabled={!!inflight}
          onOpenHistory={() => setStage("history")}
        />
      )}
      {stage === "loading" && <LoadingView lang={lang} />}
      {stage === "result" && result && (
        <Results
          result={result}
          locationId={locationId}
          onRegenerate={() => lastInput && run(lastInput)}
          onRestart={() => {
            setResult(null);
            setStage("survey");
          }}
        />
      )}

      {stage === "history" && (
        <History
          locationId={locationId}
          onOpen={openDetail}
          onBack={() => setStage("survey")}
        />
      )}

      {stage === "historyDetail" && detailLoading && <DetailLoading lang={lang} />}
      {stage === "historyDetail" && !detailLoading && detail && (
        // The SAME Results component the live flow uses, so copy buttons, the
        // voice-over and the PDF export all work here for free. Two differences,
        // both about money: Regenerate is hidden (it would bill a fresh Claude
        // call with no questionnaire on screen to check first), and the template
        // button only refills the form.
        <Results
          result={detail.result}
          locationId={locationId}
          onRestart={() => setStage("history")}
          restartLabel={T[lang].historyBackToList}
          onUseAsTemplate={requestTemplate}
          templateDisabled={!detail.input}
          templateHint={T[lang].templateUnavailable}
        />
      )}

      {/* Only ever opens when the draft holds text the customer typed — see
          requestTemplate. Loading a template over an empty form asks nothing. */}
      <AlertDialog
        open={!!pendingTemplate}
        onOpenChange={(o) => !o && setPendingTemplate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{T[lang].templateOverwriteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{T[lang].templateOverwriteDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{T[lang].historyCancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingTemplate) applyTemplate(pendingTemplate);
                setPendingTemplate(null);
              }}
            >
              {T[lang].templateOverwriteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
};

/** Shown above the questionnaire when a generation this browser paid for is
 *  still unaccounted for. Names the elapsed time so the wait feels finite. */
function InflightNotice({
  uiLang,
  startedAt,
  checking,
  onCheck,
}: {
  uiLang: "cn" | "en";
  startedAt: number;
  checking: boolean;
  onCheck: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(0, Math.round((now - startedAt) / 1000));

  return (
    <div className="mx-auto mb-6 max-w-[1600px] rounded-2xl border-2 border-[#141414] bg-[#fed50a]/15 px-5 py-4">
      <div className="flex items-start gap-3">
        <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-[#141414]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#141414]">
            {uiLang === "cn"
              ? `上次生成还在进行中（已等待 ${secs} 秒）`
              : `Your last generation is still running (${secs}s so far)`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {uiLang === "cn"
              ? "它在服务器上继续跑，不会因为你刷新而丢失。请不要重新生成 —— 那会再收一次费。"
              : "It keeps running on the server and is not lost by refreshing. Please don't generate again — that would charge you a second time."}
          </p>
          <button
            onClick={onCheck}
            disabled={checking}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl border-2 border-[#141414] bg-white px-4 text-sm font-semibold text-[#141414] disabled:opacity-50"
          >
            {checking && <Loader2 className="h-4 w-4 animate-spin" />}
            {uiLang === "cn" ? "检查结果" : "Check for result"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Opening one history entry — a short fetch, so this is a quiet placeholder
 *  rather than the full-screen ceremony a real generation gets. */
function DetailLoading({ lang }: { lang: Language }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">{T[lang].historyLoading}</p>
    </div>
  );
}

function LoadingView({ lang }: { lang: Language }) {
  const t = T[lang];
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-[#fed50a]/30" />
        <div className="btn-gradient relative flex h-20 w-20 items-center justify-center rounded-full">
          <Sparkles className="h-9 w-9" />
        </div>
      </div>
      <h2 className="mt-8 text-2xl font-bold">{t.loadingTitle}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{t.loadingDesc}</p>
      <Loader2 className="mt-6 h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default Copywriter;
