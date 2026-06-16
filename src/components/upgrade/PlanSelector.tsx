import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, TrendingUp, Users } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

type Bi = { en: string; cn: string };
const bi = (en: string, cn: string): Bi => ({ en, cn });

const profiles = [
  {
    icon: User,
    title: bi("Beginner", "新手用户"),
    bullets: [
      bi("Just starting, few clients", "刚开始，没有很多客户"),
      bi("Want basic automation", "想自动化基础流程"),
    ],
    rec: bi("Nurture Plan", "Nurture Plan"),
    anchor: "pricing-nurture",
  },
  {
    icon: TrendingUp,
    title: bi("Growing", "成长中用户"),
    bullets: [
      bi("Daily inquiries coming in", "每天有询问"),
      bi("Want higher close rate", "想提高成交率"),
    ],
    rec: bi("Nurture + WhatsApp Add-on", "Nurture + WhatsApp 附加包"),
    anchor: "pricing-combo",
  },
  {
    icon: Users,
    title: bi("High Volume / Team", "高流量 / 团队"),
    bullets: [
      bi("Many clients", "客户很多"),
      bi("Handle large conversation volumes", "需要处理大量对话"),
    ],
    rec: bi("Nurture + Multiple WhatsApp Add-ons", "Nurture + 多个 WhatsApp 附加包"),
    anchor: "pricing-combo",
  },
];

const PlanSelector = () => {
  const { lang } = useLang();
  const l = (b: Bi) => b[lang];
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (i: number) => {
    setSelected(i);
    setTimeout(() => {
      document.getElementById(profiles[i].anchor)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  };

  return (
    <section className="max-w-4xl mx-auto px-6 mb-24">
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">
          🎯 {l(bi("Which plan fits you?", "你适合哪个方案？"))}
        </h2>
        <p className="text-muted-foreground text-sm">
          {l(bi("Click your profile to see our recommendation", "点击你的情况，查看推荐方案"))}
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-5">
        {profiles.map((p, i) => {
          const active = selected === i;
          return (
            <Card
              key={i}
              onClick={() => handleSelect(i)}
              className={`cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg border-2 ${
                active ? "border-accent shadow-xl scale-[1.02]" : "border-border/60"
              }`}
            >
              <CardContent className="p-6">
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center mb-4">
                  <p.icon className="h-5 w-5 text-foreground" />
                </div>
                <h3 className="font-bold mb-3">{l(p.title)}</h3>
                <ul className="space-y-1.5 mb-5">
                  {p.bullets.map((b, j) => (
                    <li key={j} className="text-sm text-muted-foreground">• {l(b)}</li>
                  ))}
                </ul>
                {active && (
                  <Badge className="bg-accent text-accent-foreground border-0 text-xs animate-in fade-in slide-in-from-bottom-2 duration-300">
                    👉 {l(bi("Recommended:", "推荐："))} {l(p.rec)}
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
};

export default PlanSelector;
