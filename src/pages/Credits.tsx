import { Card, CardContent } from "@/components/ui/card";
import {
  Clock, ListChecks, Eye,
  Check
} from "lucide-react";
import ServicePricingGrid from "@/components/credits/ServicePricingGrid";
import { useLang } from "@/i18n/LanguageContext";

type Bi = { en: string; cn: string };
const bi = (en: string, cn: string): Bi => ({ en, cn });

const Credits = () => {
  const { lang, hideSubtitles } = useLang();

  const l = (b: Bi) => b[lang];

  return (
    <main className="pt-24 pb-20">

        {/* ═══ SECTION 1: HERO ═══ */}
        <section className="max-w-4xl mx-auto px-6 text-center mb-24">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-5">
            {l(bi("Only Pay When You Use AI", "只有使用 AI 时才收费"))}
          </h1>
          {!hideSubtitles && (
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
              {l(bi(
                "You are only charged when AI is used. No hidden fees, no confusion.",
                "只有在使用 AI 时才会扣费。没有隐藏费用，没有困惑。"
              ))}
            </p>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-sm">
            {[
              bi("No usage = No charge", "不使用 = 不收费"),
              bi("Pay only for what you use", "只为你使用的部分付费"),
              bi("Full transparency on every action", "每一次操作完全透明"),
            ].map((item, i) => (
              <span key={i} className="flex items-center gap-2 text-foreground">
                <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                {l(item)}
              </span>
            ))}
          </div>
        </section>

        {/* ═══ SECTION 2: SERVICE PRICING ═══ */}
        <ServicePricingGrid />




        {/* ═══ SECTION 4: TRANSPARENCY ═══ */}
        <section className="max-w-5xl mx-auto px-6 mb-24">
          <h2 className="text-3xl font-bold text-center mb-3">
            {l(bi("Full control, full transparency", "完全掌控，完全透明"))}
          </h2>
          {!hideSubtitles && (
            <p className="text-center text-muted-foreground mb-12">
              {l(bi("No hidden charges. Everything is visible.", "没有隐藏费用。一切清晰可见。"))}
            </p>
          )}

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: Eye, title: bi("Track remaining credits in real-time", "实时追踪剩余额度") },
              { icon: Clock, title: bi("View detailed usage history", "查看详细使用记录") },
              { icon: ListChecks, title: bi("See exactly what consumes credits", "清楚看到每一笔额度消耗") },
            ].map((item, i) => (
              <Card key={i} className="border border-border/60 shadow-sm text-center hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                <CardContent className="p-8">
                  <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center mx-auto mb-4">
                    <item.icon className="h-6 w-6 text-foreground" />
                  </div>
                  <p className="text-sm font-medium">{l(item.title)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>




    </main>
  );
};

export default Credits;
