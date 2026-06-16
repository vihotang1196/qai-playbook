import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, TrendingUp, MessageSquare } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

type Bi = { en: string; cn: string };
const bi = (en: string, cn: string): Bi => ({ en, cn });

const nurtureFeatures = [
  bi("Manage multiple brands / clients simultaneously", "同时管理多个品牌 / 客户"),
  bi("Each account runs independently", "每个账号独立运作"),
  bi("Perfect for agencies / multi-project users", "适合 agency / 多项目用户"),
  bi("Expand your revenue sources", "扩展收入来源"),
];

const waFeatures = [
  bi("Handle more client conversations simultaneously", "同时处理更多客户对话"),
  bi("Avoid missed leads / slow replies", "避免漏单 / 慢回复"),
  bi("Increase closing efficiency", "提高成交效率"),
  bi("Add multiple WhatsApp per account", "每个账号可增加多个 WhatsApp"),
];

const ExpansionCards = () => {
  const { lang, hideSubtitles } = useLang();
  const l = (b: Bi) => b[lang];

  return (
    <section className="max-w-5xl mx-auto px-6 mb-24">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Nurture Plan - Expand Accounts */}
        <Card className="relative border-2 border-accent/40 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-2xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-accent" />
          <CardContent className="p-8">
            <div className="flex items-center gap-2 mb-5">
              <Badge className="bg-accent text-accent-foreground border-0 text-xs">
                <TrendingUp className="h-3 w-3 mr-1" />
                📈 {l(bi("Expand Business", "扩展业务"))}
              </Badge>
            </div>

            <h3 className="text-2xl font-bold mb-1">
              {l(bi("Increase your account capacity (up to 6)", "增加你的账号数量（最多 6 个）"))}
            </h3>
            {!hideSubtitles && (
              <p className="text-sm text-muted-foreground mb-6">
                {l(bi(
                  "Turn your system into a multi-business / multi-brand management platform",
                  "把你的系统变成「多业务 / 多品牌管理平台」"
                ))}
              </p>
            )}

            <div className="space-y-3 mb-6">
              {nurtureFeatures.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-accent-foreground" />
                  </div>
                  <span className="text-sm">{l(f)}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-accent/5 border border-accent/20 p-4 mb-6 text-center">
              <p className="text-sm font-bold">
                👉 {l(bi("From 1 account → 6 accounts", "从 1 个账号 → 6 个账号"))}
              </p>
            </div>

            <Button variant="accent" size="lg" className="w-full" asChild>
              <a href="https://wa.me/601112436811" target="_blank" rel="noopener noreferrer">
                {l(bi("Upgrade Account Capacity", "升级账号容量"))}
                <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* WhatsApp Add-on - Expand Capacity */}
        <Card className="relative border border-border/60 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 rounded-2xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-foreground/20" />
          <CardContent className="p-8">
            <div className="flex items-center gap-2 mb-5">
              <Badge variant="outline" className="text-xs">
                <MessageSquare className="h-3 w-3 mr-1" />
                💬 {l(bi("Increase Capacity", "提升处理能力"))}
              </Badge>
            </div>

            <h3 className="text-2xl font-bold mb-1">
              {l(bi("Add WhatsApp Conversation Capacity", "增加 WhatsApp 对话容量"))}
            </h3>
            {!hideSubtitles && (
              <p className="text-sm text-muted-foreground mb-4">
                {l(bi(
                  "When clients increase, you need more processing power",
                  "当客户变多，你需要更强的处理能力"
                ))}
              </p>
            )}

            {/* Loom intro video */}
            <div className="mb-6 rounded-xl overflow-hidden border border-border/60 bg-secondary/30">
              <div className="relative w-full" style={{ paddingBottom: "62.5%" }}>
                <iframe
                  src="https://www.loom.com/embed/c86119e8d171442b9f6a80375141bbc9"
                  frameBorder={0}
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                  title={l(bi("Watch Introduction", "观看介绍"))}
                />
              </div>
              <p className="text-xs text-center text-muted-foreground py-2 font-medium">
                ▶ {l(bi("Watch Introduction", "观看介绍"))}
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {waFeatures.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-foreground" />
                  </div>
                  <span className="text-sm">{l(f)}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-secondary/50 border border-border/60 p-4 mb-6 text-center">
              <p className="text-sm font-bold">
                👉 {l(bi("Not more features — more \"closing power\"", "不是更多功能，是更多「成交能力」"))}
              </p>
            </div>

            <Button variant="outline" size="lg" className="w-full" asChild>
              <a href="https://wa.me/601112436811" target="_blank" rel="noopener noreferrer">
                {l(bi("Add WhatsApp Capacity", "添加 WhatsApp 容量"))}
                <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default ExpansionCards;
