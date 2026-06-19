import { CheckCircle2 } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

const bi = (en: string, cn: string) => ({ en, cn });

const points = [
  { title: bi("Done-for-you system", "为你打造的系统"), desc: bi("Everything is set up and ready — just plug in and go", "一切已设置好 — 直接使用即可") },
  { title: bi("AI automation included", "内置 AI 自动化"), desc: bi("Not an add-on. AI is built into the core of the system", "不是附加功能，AI 是系统的核心") },
  { title: bi("Recurring credits", "持续积分"), desc: bi("Earn credits again and again from each referral", "从每次推荐反复赚取积分") },
  { title: bi("Built for beginners", "专为新手打造"), desc: bi("No tech skills, no experience, no problem", "无需技术、无需经验、没问题") },
];

const AffiliateWhyDifferent = () => {
  const { lang, hideSubtitles } = useLang();
  const l = (t: { en: string; cn: string }) => t[lang];

  return (
    <section className="py-20">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">{l(bi("Not Just Another Affiliate Program", "不只是另一个联盟计划"))}</h2>
          {!hideSubtitles && <p className="text-muted-foreground">{l(bi("Here's what makes this fundamentally different", "这是它根本不同的地方"))}</p>}
        </div>

        <div className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
          {points.map((p) => (
            <div key={p.title.en} className="flex gap-3 items-start">
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold">{l(p.title)}</h3>
                {!hideSubtitles && <p className="text-sm text-muted-foreground">{l(p.desc)}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AffiliateWhyDifferent;
