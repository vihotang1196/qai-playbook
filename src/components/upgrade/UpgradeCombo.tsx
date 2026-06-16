import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

type Bi = { en: string; cn: string };
const bi = (en: string, cn: string): Bi => ({ en, cn });

const comboBenefits = [
  bi("Multiple accounts (expand business)", "多账号（扩大业务）"),
  bi("Multiple WhatsApp (increase closings)", "多 WhatsApp（提升成交）"),
];

const UpgradeCombo = () => {
  const { lang } = useLang();
  const l = (b: Bi) => b[lang];

  return (
    <section className="max-w-3xl mx-auto px-6 mb-24">
      <Card className="relative border-2 border-accent shadow-xl rounded-2xl overflow-hidden bg-gradient-to-br from-accent/5 via-background to-accent/5">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-accent" />
        <CardContent className="p-8 sm:p-10">
          <Badge className="bg-accent text-accent-foreground border-0 text-xs mb-4">
            <Sparkles className="h-3 w-3 mr-1" />
            🔥 {l(bi("Advanced Users Choose This", "进阶用户选择"))}
          </Badge>

          <h3 className="text-2xl sm:text-3xl font-bold mb-2">
            {l(bi("The Real Way to Scale Your Business", "真正放大业务的方法"))}
          </h3>

          <div className="space-y-3 my-6">
            {comboBenefits.map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-5 w-5 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3 text-accent-foreground" />
                </div>
                <span className="text-sm font-medium">{l(b)}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-accent/5 border border-accent/20 p-4 mb-8 text-center">
            <p className="text-sm font-bold">
              👉 {l(bi("More clients + Faster closings = Revenue multiplied", "更多客户 + 更快成交 = 收入放大"))}
            </p>
          </div>

          <Button variant="accent" size="xl" className="w-full" asChild>
            <a href="https://wa.me/601112436811" target="_blank" rel="noopener noreferrer">
              {l(bi("Scale Your System Now", "立即扩展系统"))}
              <ArrowRight className="h-4 w-4 ml-2" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
};

export default UpgradeCombo;
