import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Briefcase, Rocket, Building2 } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

const bi = (en: string, cn: string) => ({ en, cn });

const options = [
  {
    icon: Briefcase,
    title: bi("Side Income", "副业收入"),
    range: "2k–6k Credits/month",
    desc: bi("Start with a few hours per week, build a reliable second income stream", "每周几小时，建立可靠的第二收入来源"),
    rec: bi("Start with our Starter plan — low effort, consistent returns", "从入门计划开始 — 低投入，稳定回报"),
  },
  {
    icon: Rocket,
    title: bi("Full-Time Income", "全职收入"),
    range: "10k+ Credits/month",
    desc: bi("Go all-in and replace your current salary with AI-powered affiliate income", "全力投入，用 AI 驱动的伙伴收入取代你的薪水"),
    rec: bi("Our Growth plan gives you maximum AI capacity and support", "成长计划给你最大 AI 容量和支持"),
  },
  {
    icon: Building2,
    title: bi("Scale as Agency", "扩展为代理"),
    range: "20k+ Credits/month",
    desc: bi("Manage multiple campaigns and clients using the system", "使用系统管理多个活动和客户"),
    rec: bi("Combine multiple accounts + WhatsApp capacity for agency-level scale", "组合多个账号 + WhatsApp 容量，达到代理级别规模"),
  },
];

const AffiliateWhoIsFor = () => {
  const { lang, hideSubtitles } = useLang();
  const l = (t: { en: string; cn: string }) => t[lang];
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <section className="py-20">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">{l(bi("Is This Right For You?", "这适合你吗？"))}</h2>
          {!hideSubtitles && <p className="text-muted-foreground">{l(bi("Select your goal to see your recommended path", "选择你的目标，查看推荐路径"))}</p>}
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {options.map((o, i) => (
            <button
              key={o.title.en}
              onClick={() => setSelected(i)}
              className={`text-left p-6 rounded-2xl border-2 transition-all duration-300 ${
                selected === i
                  ? "border-accent bg-accent/10 shadow-lg shadow-accent/10"
                  : "border-border hover:border-accent/50 hover:shadow-md"
              }`}
            >
              <o.icon className={`h-8 w-8 mb-4 ${selected === i ? "text-accent-foreground" : "text-muted-foreground"}`} />
              <h3 className="font-bold text-lg mb-1">{l(o.title)}</h3>
              <p className="text-sm font-semibold text-accent-foreground mb-2">{o.range}</p>
              {!hideSubtitles && <p className="text-sm text-muted-foreground">{l(o.desc)}</p>}
            </button>
          ))}
        </div>

        {selected !== null && (
          <div className="mt-8 p-6 rounded-2xl bg-accent/5 border border-accent/30 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <p className="text-sm text-muted-foreground mb-1">{l(bi("Recommended for you", "为你推荐"))}</p>
            <p className="font-semibold mb-4">{l(options[selected].rec)}</p>
            <Button asChild>
              <a href="https://wa.me/601112436811" target="_blank" rel="noopener noreferrer">
                {l(bi("Get Started", "立即开始"))} <ArrowRight className="h-4 w-4 ml-1" />
              </a>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};

export default AffiliateWhoIsFor;
