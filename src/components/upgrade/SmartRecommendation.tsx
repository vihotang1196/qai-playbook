import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Users, MessageCircle, Zap } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

type Bi = { en: string; cn: string };
const bi = (en: string, cn: string): Bi => ({ en, cn });

const scenarios = [
  {
    icon: Users,
    label: bi("Multiple clients / projects", "多客户 / 多项目"),
    rec: bi("Nurture Plan — Expand accounts", "Nurture Plan — 扩展账号"),
  },
  {
    icon: MessageCircle,
    label: bi("High conversation volume", "高对话量"),
    rec: bi("WhatsApp Add-on — Increase capacity", "WhatsApp Add-on — 提升容量"),
  },
  {
    icon: Zap,
    label: bi("Both of the above", "以上两个都有"),
    rec: bi("Both — Expand accounts + Increase capacity", "两个都要 — 扩展账号 + 提升容量"),
  },
];

const SmartRecommendation = () => {
  const { lang, hideSubtitles } = useLang();
  const l = (b: Bi) => b[lang];
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <section className="max-w-3xl mx-auto px-6 mb-24">
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">
          🎯 {l(bi("System Recommendation", "系统建议"))}
        </h2>
        {!hideSubtitles && (
          <p className="text-muted-foreground text-sm">
            {l(bi("Select your situation to see what's best for you", "选择你的情况，查看最适合方案"))}
          </p>
        )}
      </div>

      <div className="space-y-3 mb-8">
        {scenarios.map((s, i) => {
          const active = selected === i;
          return (
            <Card
              key={i}
              onClick={() => setSelected(i)}
              className={`cursor-pointer transition-all duration-300 border-2 ${
                active ? "border-accent shadow-lg" : "border-border/60 hover:border-accent/30"
              }`}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                  active ? "bg-accent/20" : "bg-secondary"
                }`}>
                  <s.icon className="h-5 w-5 text-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{l(s.label)}</p>
                  {active && (
                    <p className="text-xs text-accent-foreground mt-1 animate-in fade-in slide-in-from-bottom-1 duration-200">
                      👉 {l(s.rec)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selected === 2 && (
        <Card className="border-2 border-accent bg-gradient-to-br from-accent/5 via-background to-accent/5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CardContent className="p-6 text-center">
            <Badge className="bg-accent text-accent-foreground border-0 text-xs mb-3">
              <Sparkles className="h-3 w-3 mr-1" />
              🔥 {l(bi("Most Recommended", "最推荐"))}
            </Badge>
            <p className="font-bold">
              {l(bi("Expand accounts + Increase conversation capacity", "扩展账号 + 提升对话能力"))}
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
};

export default SmartRecommendation;
