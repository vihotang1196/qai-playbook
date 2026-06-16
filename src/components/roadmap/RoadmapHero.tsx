import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";

const EARLY_ACCESS_LINK = "#final-cta";
const ROADMAP_LINK = "#roadmap-timeline";

const RoadmapHero = () => {
  const { lang } = useLang();
  const r = t.roadmap.hero;

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-accent/8 blur-[120px]" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(0,0%,20%)] to-transparent" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Badge */}
        <div className="fade-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[hsl(0,0%,15%)] bg-[hsl(0,0%,6%)] backdrop-blur-sm mb-8">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs font-medium tracking-wide text-[hsl(0,0%,60%)] uppercase">
            {r.badge[lang]}
          </span>
        </div>

        <h1 className="fade-up text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight leading-[1.08]">
          {r.title1[lang]}
          <br />
          {r.title2[lang]}{" "}
          <span className="text-accent">{r.titleAccent[lang]}</span>
        </h1>

        <p className="fade-up fade-up-delay-1 mt-6 text-lg md:text-xl text-[hsl(0,0%,55%)] max-w-2xl mx-auto leading-relaxed whitespace-pre-line">
          {r.subtitle[lang]}
        </p>

        <div className="fade-up fade-up-delay-2 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button variant="accent" size="xl" onClick={() => document.querySelector(EARLY_ACCESS_LINK)?.scrollIntoView({ behavior: "smooth" })}>
            {r.cta[lang]}
            <ArrowRight size={18} />
          </Button>
          <Button
            variant="ghost"
            size="xl"
            className="text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,90%)] hover:bg-[hsl(0,0%,10%)]"
            onClick={() => document.querySelector(ROADMAP_LINK)?.scrollIntoView({ behavior: "smooth" })}
          >
            {r.ctaSecondary[lang]}
          </Button>
        </div>

        {/* Trust line */}
        <p className="fade-up fade-up-delay-3 mt-12 text-xs text-[hsl(0,0%,40%)] tracking-wide">
          {r.trust[lang]}
        </p>

        {/* Scroll indicator */}
        <div className="mt-16 flex justify-center">
          <ChevronDown size={20} className="text-[hsl(0,0%,25%)] animate-bounce" />
        </div>
      </div>
    </section>
  );
};

export default RoadmapHero;
