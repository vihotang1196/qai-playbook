import { X, Sparkles } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

const bi = (en: string, cn: string) => ({ en, cn });

const problems = [
  bi("No traffic — don't know where to start", "没有流量 — 不知从何开始"),
  bi("Don't know how to follow up with leads", "不知道如何跟进潜在客户"),
  bi("Can't convert leads into paying customers", "无法将线索转化为付费客户"),
  bi("Spending hours but seeing zero results", "花了很多时间却没有成果"),
];

const AffiliateProblem = () => {
  const { lang, hideSubtitles } = useLang();
  const l = (t: { en: string; cn: string }) => t[lang];

  return (
    <section className="py-20 bg-secondary/30">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          {l(bi("Most People", "大多数人"))}{" "}
          <span className="text-destructive">{l(bi("Fail", "失败"))}</span>{" "}
          {l(bi("at Affiliate Marketing", "于联盟营销"))}
        </h2>
        {!hideSubtitles && (
          <p className="text-muted-foreground mb-12 max-w-2xl mx-auto">
            {l(bi("It's not your fault. Traditional affiliate marketing is broken.", "这不是你的错。传统联盟营销已经行不通了。"))}
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-4 mb-14 max-w-2xl mx-auto">
          {problems.map((p) => (
            <div key={p.en} className="flex items-start gap-3 text-left p-4 rounded-xl bg-destructive/5 border border-destructive/10">
              <X className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <span className="text-sm">{l(p)}</span>
            </div>
          ))}
        </div>

        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-accent/10 border border-accent/30">
          <Sparkles className="h-5 w-5 text-accent-foreground" />
          <span className="font-semibold text-accent-foreground">
            {l(bi("With AI, everything changes.", "有了 AI，一切都不同了。"))}
          </span>
        </div>
      </div>
    </section>
  );
};

export default AffiliateProblem;
