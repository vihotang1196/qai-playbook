import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";

const ProofSection = () => {
  const { lang } = useLang();
  const r = t.roadmap.proof;

  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(0,0%,15%)] to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-20">
          <p className="text-sm font-medium tracking-widest text-accent uppercase mb-4">{r.label[lang]}</p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            {r.title[lang]}
          </h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-6 mb-16">
          {r.metrics.map((m, i) => (
            <div key={i} className="group relative p-8 rounded-2xl border border-[hsl(0,0%,12%)] bg-[hsl(0,0%,5%)] text-center hover:border-accent/30 transition-all duration-500">
              <div className="absolute inset-0 rounded-2xl bg-accent/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <p className="text-5xl font-bold text-accent mb-3">{m.value}</p>
                <p className="text-sm font-semibold mb-1">{m.label[lang]}</p>
                <p className="text-xs text-[hsl(0,0%,45%)]">{m.sub[lang]}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button
            variant="accent"
            size="xl"
            onClick={() => document.querySelector("#final-cta")?.scrollIntoView({ behavior: "smooth" })}
          >
            {r.cta[lang]}
            <ArrowRight size={18} />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ProofSection;
