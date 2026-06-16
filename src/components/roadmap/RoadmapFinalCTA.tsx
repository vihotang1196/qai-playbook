import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";

const EARLY_ACCESS_LINK = "https://chat.whatsapp.com/GrVKU7wl9LuDpYeg3ycTFt";

const RoadmapFinalCTA = () => {
  const { lang } = useLang();
  const r = t.roadmap.finalCta;

  return (
    <section id="final-cta" className="py-32 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(0,0%,15%)] to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        <p className="text-sm font-medium tracking-widest text-accent uppercase mb-6">{r.label[lang]}</p>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-2">
          {r.title1[lang]}
        </h2>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-8 text-[hsl(0,0%,45%)]">
          {r.title2[lang]}
        </h2>
        <Button variant="accent" size="xl" onClick={() => window.open(EARLY_ACCESS_LINK, "_blank")}>
          {r.cta[lang]}
          <ArrowRight size={18} />
        </Button>
        <p className="mt-6 text-sm text-[hsl(0,0%,40%)]">
          {r.subtitle[lang]}
        </p>
      </div>
    </section>
  );
};

export default RoadmapFinalCTA;
