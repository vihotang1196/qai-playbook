import { Zap, TrendingUp, Bot } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";

const icons = [Zap, TrendingUp, Bot];

const ValueProposition = () => {
  const { lang } = useLang();
  const r = t.roadmap.value;

  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(0,0%,15%)] to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-20">
          <p className="text-sm font-medium tracking-widest text-accent uppercase mb-4">{r.label[lang]}</p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight whitespace-pre-line">
            {r.title[lang]}
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {r.items.map((v, i) => {
            const Icon = icons[i];
            return (
              <div
                key={i}
                className="group relative p-8 rounded-2xl border border-[hsl(0,0%,12%)] bg-[hsl(0,0%,5%)] hover:border-accent/30 transition-all duration-500"
              >
                <div className="absolute inset-0 rounded-2xl bg-accent/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-[hsl(0,0%,10%)] flex items-center justify-center mb-6 group-hover:bg-accent/10 transition-colors duration-500">
                    <Icon size={22} />
                  </div>
                  <p className="text-4xl font-bold text-accent mb-2">{v.metric}</p>
                  <h3 className="text-xl font-semibold mb-3">{v.title[lang]}</h3>
                  <p className="text-[hsl(0,0%,55%)] leading-relaxed">{v.desc[lang]}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ValueProposition;
