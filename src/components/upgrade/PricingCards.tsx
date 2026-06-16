import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, AlertTriangle, ArrowRight, Star, Plus } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

type Bi = { en: string; cn: string };
const bi = (en: string, cn: string): Bi => ({ en, cn });

const nurtureFeatures = [
  bi("Auto follow-up with clients", "自动跟进客户"),
  bi("Automated closing workflows", "自动成交流程"),
  bi("CRM to manage all clients", "CRM 管理所有客户"),
  bi("Auto WhatsApp / Email sends", "自动发送 WhatsApp / Email"),
  bi("Funnel + Landing Pages", "Funnel + Landing Page"),
  bi("AI automation tools", "AI 自动化工具"),
];

const waFeatures = [
  bi("Handle more clients simultaneously", "同时处理更多客户"),
  bi("Auto-reply to messages", "自动回复消息"),
  bi("Increase close speed", "提高成交速度"),
  bi("Scale traffic channels", "扩大流量入口"),
];

const PricingCards = () => {
  const { lang } = useLang();
  const l = (b: Bi) => b[lang];

  return (
    <section className="max-w-5xl mx-auto px-6 mb-24">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Nurture Plan */}
        <Card id="pricing-nurture" className="relative border-2 border-accent/40 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-2xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-accent" />
          <CardContent className="p-8">
            <div className="flex items-center gap-2 mb-6">
              <Badge className="bg-accent text-accent-foreground border-0 text-xs">
                <Star className="h-3 w-3 mr-1" />
                {l(bi("Most Popular", "最多人选择"))}
              </Badge>
            </div>

            <h3 className="text-2xl font-bold mb-1">Nurture Plan</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {l(bi("For those who want an automated money-making system", "适合：想建立自动赚钱系统的人"))}
            </p>

            <div className="space-y-3 mb-8">
              {nurtureFeatures.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-accent-foreground" />
                  </div>
                  <span className="text-sm">{l(f)}</span>
                </div>
              ))}
            </div>

            {/* Mini preview */}
            <div className="rounded-xl bg-secondary/50 p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-[10px] text-muted-foreground font-medium">DASHBOARD</span>
              </div>
              <div className="space-y-1.5">
                <div className="h-2 rounded bg-accent/20 w-full" />
                <div className="h-2 rounded bg-accent/10 w-3/4" />
                <div className="h-2 rounded bg-accent/10 w-1/2" />
              </div>
            </div>

            <Button variant="accent" size="lg" className="w-full" asChild>
              <a href="https://wa.me/601112436811" target="_blank" rel="noopener noreferrer">
                🚀 {l(bi("Start Automated Client Acquisition", "开始自动获客"))}
                <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* WhatsApp Add-on */}
        <Card className="relative border border-border/60 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 rounded-2xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-foreground/20" />
          <CardContent className="p-8">
            <div className="flex items-center gap-2 mb-6">
              <Badge variant="outline" className="text-xs">
                <Plus className="h-3 w-3 mr-1" />
                {l(bi("Expansion", "扩展功能"))}
              </Badge>
            </div>

            <h3 className="text-2xl font-bold mb-1">WhatsApp Add-on</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {l(bi("For those with many daily inquiries", "适合：每天有很多询问的人"))}
            </p>

            <div className="space-y-3 mb-8">
              {waFeatures.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-foreground" />
                  </div>
                  <span className="text-sm">{l(f)}</span>
                </div>
              ))}
            </div>

            {/* Mini chat preview */}
            <div className="rounded-xl bg-secondary/50 p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-[10px] text-muted-foreground font-medium">WHATSAPP</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-end"><div className="h-5 rounded-full bg-accent/20 w-24" /></div>
                <div className="flex"><div className="h-5 rounded-full bg-secondary w-32" /></div>
                <div className="flex justify-end"><div className="h-5 rounded-full bg-accent/20 w-20" /></div>
              </div>
            </div>

            {/* Warning */}
            <div className="rounded-xl bg-secondary/50 border border-border/60 p-3 flex items-start gap-2 mb-6">
              <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                {l(bi("Requires active Nurture Plan subscription", "需要 Nurture Plan"))}
              </p>
            </div>

            <Button variant="outline" size="lg" className="w-full" asChild>
              <a href="https://wa.me/601112436811" target="_blank" rel="noopener noreferrer">
                {l(bi("Add WhatsApp", "添加 WhatsApp"))}
                <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default PricingCards;
