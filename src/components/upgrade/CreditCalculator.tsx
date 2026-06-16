import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Info } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

type Bi = { en: string; cn: string };
const bi = (en: string, cn: string): Bi => ({ en, cn });

const tiers = [
  { max: 300, label: bi("Light usage", "轻度使用"), credits: "200", idx: 0 },
  { max: 700, label: bi("Recommended", "推荐"), credits: "500", idx: 1 },
  { max: Infinity, label: bi("Heavy usage", "高使用"), credits: "1000+", idx: 2 },
];

const RangeSlider = ({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="relative w-full">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-secondary accent-accent"
        style={{
          background: `linear-gradient(to right, hsl(var(--accent)) 0%, hsl(var(--accent)) ${pct}%, hsl(var(--secondary)) ${pct}%, hsl(var(--secondary)) 100%)`,
        }}
      />
    </div>
  );
};

const CreditCalculator = () => {
  const { lang } = useLang();
  const l = (b: Bi) => b[lang];

  const [convos, setConvos] = useState(50);
  const [interactions, setInteractions] = useState(5);
  const [automation, setAutomation] = useState(true);

  const raw = convos * interactions * 30;
  const estimated = automation ? Math.round(raw * 0.6) : raw;
  const tier = tiers.find((t) => estimated <= t.max) || tiers[2];

  return (
    <section className="max-w-3xl mx-auto px-6 mb-24">
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">
          💰 {l(bi("Estimate your monthly credits", "估算你每月需要多少 Credits"))}
        </h2>
        <p className="text-muted-foreground text-sm">
          {l(bi("We'll recommend the best plan based on your usage", "根据你的业务自动推荐最适合的用量"))}
        </p>
      </div>

      <Card className="border border-border/60 shadow-sm">
        <CardContent className="p-8 space-y-8">
          {/* Slider 1 */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-medium">
                {l(bi("Daily conversations", "每天对话数量"))}
              </label>
              <span className="text-sm font-bold tabular-nums">{convos}</span>
            </div>
            <RangeSlider value={convos} onChange={setConvos} min={0} max={500} step={10} />
          </div>

          {/* Slider 2 */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-medium">
                {l(bi("Avg interactions per client", "每个客户平均互动次数"))}
              </label>
              <span className="text-sm font-bold tabular-nums">{interactions}</span>
            </div>
            <RangeSlider value={interactions} onChange={setInteractions} min={1} max={20} step={1} />
          </div>

          {/* Automation toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              {l(bi("Using automation?", "是否使用自动化？"))}
            </label>
            <button
              onClick={() => setAutomation(!automation)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                automation ? "bg-accent" : "bg-secondary"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-background shadow-lg transition-transform ${
                  automation ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Result */}
          <div className="rounded-2xl bg-secondary/50 p-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">{l(bi("Estimated monthly usage", "每月预计使用"))}</p>
            <p className="text-4xl font-extrabold tracking-tight">
              {estimated.toLocaleString()}{" "}
              <span className="text-lg font-medium text-muted-foreground">Credits</span>
            </p>
            <Badge
              className={`text-xs border-0 ${
                tier.idx === 1
                  ? "bg-accent text-accent-foreground"
                  : tier.idx === 2
                    ? "bg-foreground text-background"
                    : "bg-secondary text-foreground"
              }`}
            >
              {l(tier.label)} — {tier.credits} Credits
            </Badge>
          </div>

          {/* Insights */}
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{l(bi("Most users underestimate usage", "大部分用户会低估用量"))}</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{l(bi("We recommend +20% buffer to avoid interruptions", "建议选择 +20% buffer 避免中断"))}</span>
            </div>
          </div>

          <Button variant="accent" size="lg" className="w-full" asChild>
            <a href="https://wa.me/601112436811" target="_blank" rel="noopener noreferrer">
              {l(bi("Choose this plan", "选择这个方案"))}
              <ArrowRight className="h-4 w-4 ml-2" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
};

export default CreditCalculator;
