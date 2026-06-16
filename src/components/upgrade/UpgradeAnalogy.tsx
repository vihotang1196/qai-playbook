import { Card, CardContent } from "@/components/ui/card";
import { useLang } from "@/i18n/LanguageContext";
import { ArrowRight } from "lucide-react";

type Bi = { en: string; cn: string };
const bi = (en: string, cn: string): Bi => ({ en, cn });

const UpgradeAnalogy = () => {
  const { lang } = useLang();
  const l = (b: Bi) => b[lang];

  return (
    <section className="max-w-3xl mx-auto px-6 mb-24">
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">
          {l(bi("Think of it this way", "简单理解"))}
        </h2>
      </div>

      <Card className="rounded-2xl border border-border/60">
        <CardContent className="p-8">
          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            <div className="text-center">
              <div className="text-4xl mb-3">🏢</div>
              <p className="font-bold text-sm mb-1">Nurture Plan</p>
              <p className="text-xs text-muted-foreground">
                = {l(bi("Multiple stores", "多间店"))}
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">💬</div>
              <p className="font-bold text-sm mb-1">WhatsApp Add-on</p>
              <p className="text-xs text-muted-foreground">
                = {l(bi("Salespeople per store", "每间店的销售员"))}
              </p>
            </div>
          </div>

          {/* Before vs After */}
          <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-4 items-center">
            <div className="rounded-xl bg-secondary/50 p-5 text-center">
              <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
                {l(bi("Without upgrade", "升级前"))}
              </p>
              <p className="text-2xl mb-1">🏢</p>
              <p className="text-sm font-medium">1 {l(bi("store", "间店"))} + 1 sales</p>
            </div>

            <div className="hidden sm:flex items-center justify-center">
              <ArrowRight className="h-5 w-5 text-accent" />
            </div>
            <div className="flex sm:hidden items-center justify-center py-1">
              <ArrowRight className="h-5 w-5 text-accent rotate-90" />
            </div>

            <div className="rounded-xl bg-accent/5 border border-accent/20 p-5 text-center">
              <p className="text-xs text-accent-foreground mb-2 font-medium uppercase tracking-wide">
                {l(bi("After upgrade", "升级后"))}
              </p>
              <p className="text-2xl mb-1">🏢🏢🏢🏢🏢🏢</p>
              <p className="text-sm font-bold">6 {l(bi("stores", "间店"))} + {l(bi("multiple sales", "多个 sales"))}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};

export default UpgradeAnalogy;
