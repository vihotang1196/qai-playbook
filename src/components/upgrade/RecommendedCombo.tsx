import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

type Bi = { en: string; cn: string };
const bi = (en: string, cn: string): Bi => ({ en, cn });

const comboBenefits = [
  bi("Automated acquisition + automated closing", "自动获客 + 自动成交"),
  bi("No need to hire customer service", "不需要请客服"),
  bi("One system runs your entire business", "一套系统跑完整业务"),
];

const RecommendedCombo = () => {
  const { lang } = useLang();
  const l = (b: Bi) => b[lang];

  return (
    <section id="pricing-combo" className="max-w-3xl mx-auto px-6 mb-24">
      <Card className="relative border-2 border-accent shadow-xl rounded-2xl overflow-hidden bg-gradient-to-br from-accent/5 via-background to-accent/5">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-accent" />
        <CardContent className="p-8 sm:p-10">
          <div className="flex items-center gap-2 mb-4">
            <Badge className="bg-accent text-accent-foreground border-0 text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              🔥 {l(bi("90% of users choose this", "90%用户选择"))}
            </Badge>
          </div>

          <h3 className="text-2xl sm:text-3xl font-bold mb-2">
            Nurture + WhatsApp
          </h3>
          <p className="text-sm text-muted-foreground mb-8">
            {l(bi("The complete system for automated growth", "完整的自动化增长系统"))}
          </p>

          <div className="space-y-3 mb-8">
            {comboBenefits.map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-5 w-5 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3 text-accent-foreground" />
                </div>
                <span className="text-sm font-medium">{l(b)}</span>
              </div>
            ))}
          </div>

          <Button variant="accent" size="xl" className="w-full" asChild>
            <a href="https://wa.me/601112436811" target="_blank" rel="noopener noreferrer">
              {l(bi("Launch the complete system", "立即启动完整系统"))}
              <ArrowRight className="h-4 w-4 ml-2" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
};

export default RecommendedCombo;
