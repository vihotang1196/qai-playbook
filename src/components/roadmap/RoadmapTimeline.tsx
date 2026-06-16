import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Clock, Rocket, Star } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";

const phaseIcons = [Check, Clock, Rocket];
const dotColors = ["bg-accent", "bg-accent/60", "bg-accent/30"];

const RoadmapTimeline = () => {
  const { lang } = useLang();
  const r = t.roadmap.timeline;

  return (
    <section id="roadmap-timeline" className="py-32 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(0,0%,15%)] to-transparent" />
      </div>

      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-20">
          <p className="text-sm font-medium tracking-widest text-accent uppercase mb-4">{r.label[lang]}</p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            {r.title[lang]}
          </h2>
        </div>

        {/* Timeline */}
        <div className="relative">
          <div className="absolute left-6 md:left-8 top-0 bottom-0 w-px bg-gradient-to-b from-accent via-accent/30 to-transparent" />

          <div className="space-y-12">
            {r.phases.map((phase, i) => {
              const Icon = phaseIcons[i];
              return (
                <div key={i} className="relative pl-16 md:pl-20 group">
                  <div className={`absolute left-4 md:left-6 w-4 h-4 rounded-full ${dotColors[i]} ring-4 ring-[hsl(0,0%,3%)]`} />

                  <div className="p-6 rounded-2xl border border-[hsl(0,0%,12%)] bg-[hsl(0,0%,5%)] hover:border-accent/20 transition-all duration-500">
                    <div className="flex items-center gap-3 mb-4">
                      <Icon size={16} className="text-accent" />
                      <span className="text-xs font-medium tracking-widest text-accent uppercase">{phase.label[lang]}</span>
                    </div>
                    <h3 className="text-xl font-bold mb-4">{phase.title[lang]}</h3>
                    <ul className="space-y-2">
                      {phase.items.map((item, j) => (
                        <li key={j} className="flex items-start gap-3 text-sm text-[hsl(0,0%,55%)]">
                          <span className="w-1 h-1 rounded-full bg-accent/50 mt-2 shrink-0" />
                          {item[lang]}
                        </li>
                      ))}
                    </ul>

                    {"cta" in phase && phase.cta && (
                      <div className="mt-6 pt-4 border-t border-[hsl(0,0%,12%)]">
                        <p className="text-sm text-[hsl(0,0%,55%)] mb-3">{r.phaseCta[lang]}</p>
                        <Button
                          variant="accent"
                          size="lg"
                          onClick={() => document.querySelector("#final-cta")?.scrollIntoView({ behavior: "smooth" })}
                        >
                          {t.roadmap.hero.cta[lang]}
                          <ArrowRight size={16} />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default RoadmapTimeline;
