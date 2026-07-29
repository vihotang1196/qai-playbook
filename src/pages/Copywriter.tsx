import { useEffect, useState } from "react";
import { Loader2, Sparkles, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Survey } from "@/components/copywriter/Survey";
import { Results } from "@/components/copywriter/Results";
import OpenFromQai from "@/components/OpenFromQai";
import { generateCopy, recoverCopy } from "@/lib/copywriter/api";
import { resolveLocationId } from "@/lib/ghl";
import { useLang } from "@/i18n/LanguageContext";
import { T, type Language } from "@/lib/copywriter/i18n";
import type { GenerateResult, SurveyInput } from "@/lib/copywriter/types";

type Stage = "survey" | "loading" | "result";

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

  /** "Check result" — collect a generation that finished while we were away. */
  const checkInflight = async () => {
    if (!inflight || checking) return;
    setChecking(true);
    try {
      const r = await recoverCopy(locationId, inflight.requestId);
      if (r) {
        clearInflight();
        setInflight(null);
        setResult(r);
        setLastInput((prev) => prev ?? ({ language: r.language } as SurveyInput));
        setStage("result");
        toast.success(uiLang === "cn" ? "已找回上次生成的文案" : "Recovered your last generation");
      } else {
        toast.message(
          uiLang === "cn"
            ? "还没生成好，请再等一下"
            : "Not ready yet — give it a little longer",
        );
      }
    } finally {
      setChecking(false);
    }
  };

  const lang: Language = (lastInput?.language as Language) || "zh";

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
    <main className="pt-24 pb-20">
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
      {stage === "survey" && <Survey onSubmit={run} disabled={!!inflight} />}
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
    <div className="mx-auto mb-6 max-w-3xl rounded-2xl border-2 border-[#141414] bg-[#fed50a]/15 px-5 py-4">
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
