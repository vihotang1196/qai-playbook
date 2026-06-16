import { Users, Bot, MessageCircle, DollarSign, ArrowDown } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

const bi = (en: string, cn: string) => ({ en, cn });

const steps = [
  { icon: Users, label: bi("Get Traffic", "获取流量"), desc: bi("We guide you step-by-step", "我们一步步指导你"), color: "bg-accent" },
  { icon: Bot, label: bi("AI Follows Up", "AI 自动跟进"), desc: bi("Automatic 24/7 responses", "全天候自动回复"), color: "bg-accent" },
  { icon: MessageCircle, label: bi("AI Nurtures", "AI 培育客户"), desc: bi("Build trust on autopilot", "自动建立信任"), color: "bg-accent" },
  { icon: DollarSign, label: bi("AI Converts", "AI 成交"), desc: bi("Close deals without hard selling", "无需硬推销即可成交"), color: "bg-green-500" },
  { icon: DollarSign, label: bi("You Earn", "你赚积分"), desc: bi("Recurring credits", "持续积分收入"), color: "bg-green-500" },
];

const AffiliateHowItWorks = () => {
  const { lang, hideSubtitles } = useLang();
  const l = (t: { en: string; cn: string }) => t[lang];

  return (
    <section className="py-20">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">{l(bi("How You Make Money With This System", "如何用这个系统赚钱"))}</h2>
          {!hideSubtitles && <p className="text-muted-foreground">{l(bi("5 simple steps. AI handles most of the work.", "5 个简单步骤。AI 处理大部分工作。"))}</p>}
        </div>

        <div className="space-y-0">
          {steps.map((s, i) => (
            <div key={s.label.en} className="flex flex-col items-center">
              <div className="flex items-center gap-5 w-full max-w-md">
                <div className={`${s.color} text-accent-foreground rounded-xl w-12 h-12 flex items-center justify-center shrink-0`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">{l(bi(`Step ${i + 1}: `, `步骤 ${i + 1}：`))}{l(s.label)}</div>
                  {!hideSubtitles && <div className="text-sm text-muted-foreground">{l(s.desc)}</div>}
                </div>
              </div>
              {i < steps.length - 1 && (
                <ArrowDown className="h-5 w-5 text-muted-foreground/40 my-3" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AffiliateHowItWorks;
