import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle, ShieldCheck, Users, Clock } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

const bi = (en: string, cn: string) => ({ en, cn });

const badges = [
  { icon: ShieldCheck, label: bi("100% Beginner Friendly", "100% 新手友好") },
  { icon: Users, label: bi("500+ Active Users", "500+ 活跃用户") },
  { icon: Clock, label: bi("24/7 AI Support", "全天候 AI 支持") },
];

const AffiliateFinalCTA = () => {
  const { lang, hideSubtitles } = useLang();
  const l = (t: { en: string; cn: string }) => t[lang];

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="relative max-w-3xl mx-auto px-6">
        <div className="glass-panel p-10 md:p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            {l(bi("Start Building Your AI Income System Today", "今天就开始建立你的 AI 收入系统"))}
          </h2>
          {!hideSubtitles && (
            <>
              <p className="text-muted-foreground mb-3 text-lg">
                {l(bi("Limited slots available to ensure quality support", "名额有限，确保优质支持"))}
              </p>
              <p className="text-muted-foreground/80 text-sm mb-8">
                {l(bi("Join now and get personalized onboarding", "立即加入，获得个性化指导"))}
              </p>
            </>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
            <Button size="xl" className="shadow-xl" asChild>
              <a href="https://wa.me/601112436811" target="_blank" rel="noopener noreferrer">
                {l(bi("Apply Now", "立即申请"))} <ArrowRight className="h-4 w-4 ml-1" />
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="https://wa.me/601112436811" target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4 mr-1" /> {l(bi("Chat on WhatsApp", "WhatsApp 咨询"))}
              </a>
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-6">
            {badges.map((b) => (
              <div key={b.label.en} className="flex items-center gap-2 text-muted-foreground text-sm">
                <b.icon className="h-4 w-4" />
                <span>{l(b.label)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AffiliateFinalCTA;
