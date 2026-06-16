import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Calculator } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

const bi = (en: string, cn: string) => ({ en, cn });

const AffiliateCalculator = () => {
  const { lang } = useLang();
  const l = (t: { en: string; cn: string }) => t[lang];
  const [people, setPeople] = useState(5);
  const commission = 500;
  const yearly = people * commission;

  return (
    <section className="py-20 bg-secondary/30">
      <div className="max-w-2xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <Calculator className="h-5 w-5 text-accent-foreground" />
            <span className="text-sm font-semibold text-accent-foreground">{l(bi("Credits Calculator", "积分计算器"))}</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold">{l(bi("Estimate Your Yearly Credits", "估算你的年积分"))}</h2>
        </div>

        <div className="rounded-2xl border bg-card p-8 space-y-8">
          <div>
            <div className="flex justify-between mb-3">
              <span className="text-sm font-medium">{l(bi("How many people", "多少人"))}</span>
              <span className="text-sm font-bold">{people}</span>
            </div>
            <Slider value={[people]} onValueChange={([v]) => setPeople(v)} min={1} max={20} step={1} />
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">{l(bi("Credits per referral", "每人积分"))}</p>
            <p className="text-xl font-bold">$500 Credits</p>
          </div>

          <div className="text-center pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-1">{l(bi("Estimated Yearly Credits", "预估年积分"))}</p>
            <p className="text-5xl font-bold text-accent-foreground">
              ${yearly.toLocaleString()} Credits
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              {l(bi("This is what's possible with the system", "这就是这个系统能带来的可能"))}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AffiliateCalculator;
