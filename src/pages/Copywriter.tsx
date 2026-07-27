import { useState } from "react";
import { Loader2, Sparkles, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Survey } from "@/components/copywriter/Survey";
import { Results } from "@/components/copywriter/Results";
import OpenFromQai from "@/components/OpenFromQai";
import { generateCopy } from "@/lib/copywriter/api";
import { resolveLocationId } from "@/lib/ghl";
import { useLang } from "@/i18n/LanguageContext";
import { T, type Language } from "@/lib/copywriter/i18n";
import type { GenerateResult, SurveyInput } from "@/lib/copywriter/types";

type Stage = "survey" | "loading" | "result";

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

  const run = async (input: SurveyInput) => {
    setLastInput(input);
    setStage("loading");
    try {
      const r = await generateCopy(input, locationId);
      setResult(r);
      setStage("result");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      toast.error(msg);
      setStage("survey");
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
      {stage === "survey" && <Survey onSubmit={run} />}
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
