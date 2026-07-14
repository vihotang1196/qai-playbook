import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Survey } from "@/components/copywriter/Survey";
import { Results } from "@/components/copywriter/Results";
import { getMockResult } from "@/lib/copywriter/mock";
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
 * Phase 0: generation is mocked. Phase 1 swaps `getMockResult` for the
 * `generate-copy` Supabase Edge Function (Claude).
 */
const Copywriter = () => {
  const [stage, setStage] = useState<Stage>("survey");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [lastInput, setLastInput] = useState<SurveyInput | null>(null);

  const run = async (input: SurveyInput) => {
    setLastInput(input);
    setStage("loading");
    try {
      // Phase 0 placeholder — a short delay so the loading state is visible.
      await new Promise((r) => setTimeout(r, 1200));
      const r = getMockResult(input);
      setResult(r);
      setStage("result");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      toast.error(msg);
      setStage("survey");
    }
  };

  const lang: Language = (lastInput?.language as Language) || "zh";

  return (
    <main className="pt-24 pb-20">
      {stage === "survey" && <Survey onSubmit={run} />}
      {stage === "loading" && <LoadingView lang={lang} />}
      {stage === "result" && result && (
        <Results
          result={result}
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
        <div className="absolute inset-0 animate-ping rounded-full bg-[#FF3D6E]/20" />
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
