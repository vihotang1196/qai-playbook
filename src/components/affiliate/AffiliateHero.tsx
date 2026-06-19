import { Button } from "@/components/ui/button";
import { ArrowRight, Play, CheckCircle2, Bot, TrendingUp, Zap } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

const bi = (en: string, cn: string) => ({ en, cn });

const checks = [
  bi("No experience needed", "无需经验"),
  bi("AI does the follow-up", "AI 自动跟进"),
  bi("Earn recurring income", "赚取持续收入"),
];

const AffiliateHero = () => {
  const { lang, hideSubtitles } = useLang();
  const l = (t: { en: string; cn: string }) => t[lang];

  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="relative max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/15 text-xs font-semibold tracking-wide text-accent-foreground">
              <Zap className="h-3.5 w-3.5" /> {l(bi("AI-Powered Affiliate System", "AI 驱动的伙伴系统"))}
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-[3.4rem] font-bold leading-[1.1] tracking-tight">
              {l(bi("Build Monthly Passive Income Using", "利用"))}{" "}
              <span className="text-accent">AI</span>
              {lang === "cn" && " 建立每月被动收入"}
            </h1>

            {!hideSubtitles && (
              <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
                {l(bi(
                  "Our AI system helps you attract, follow up, and close customers automatically — so you can earn recurring AI Generator Credits without hard selling.",
                  "我们的 AI 系统帮你自动吸引、跟进和成交客户 — 让你无需硬推销就能赚取持续 AI Generator Credits。"
                ))}
              </p>
            )}

            <div className="space-y-3">
              {checks.map((c) => (
                <div key={c.en} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <span className="text-sm font-medium">{l(c)}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="xl" asChild>
                <a href="https://portal.qiai.tech/affiliate/campaign" target="_blank" rel="noopener noreferrer">
                  {l(bi("Affiliate Login", "伙伴登录"))} <ArrowRight className="h-4 w-4 ml-1" />
                </a>
              </Button>
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="rounded-2xl border bg-card p-6 shadow-2xl shadow-accent/5">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="text-xs text-muted-foreground ml-2">{l(bi("AI Dashboard", "AI 控制台"))}</span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { label: bi("Total Leads", "总线索"), value: "1,247", icon: TrendingUp },
                  { label: bi("Auto Follow-ups", "自动跟进"), value: "3,891", icon: Bot },
                  { label: bi("This Month", "本月积分"), value: "16,800", icon: Zap },
                ].map((s) => (
                  <div key={s.label.en} className="rounded-xl bg-secondary/50 p-4 text-center">
                    <s.icon className="h-4 w-4 mx-auto mb-2 text-muted-foreground" />
                    <div className="text-lg font-bold">{s.value}</div>
                    <div className="text-[11px] text-muted-foreground">{l(s.label)}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {[
                  { align: "right", text: l(bi("Hi, interested in your product!", "嗨，对你的产品感兴趣！")) },
                  { align: "left", text: l(bi("Thanks! Let me share the details with you 🤖", "谢谢！让我和你分享详情 🤖")) },
                  { align: "left", text: l(bi("Here's a quick overview of how it works...", "这是运作方式的简单介绍...")) },
                ].map((m, i) => (
                  <div key={i} className={`flex ${m.align === "right" ? "justify-end" : "justify-start"}`}>
                    <div className={`text-xs px-3 py-2 rounded-xl max-w-[70%] ${m.align === "right" ? "bg-accent text-accent-foreground" : "bg-secondary"}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute -bottom-4 -left-4 bg-green-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg animate-pulse">
              +800 Credits {l(bi("earned today", "今日获得"))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AffiliateHero;
