import { Check, X } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";

const ComparisonSection = () => {
  const { lang } = useLang();
  const r = t.roadmap.comparison;

  return (
    <section className="py-32 relative">
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

        <div className="rounded-2xl border border-[hsl(0,0%,12%)] overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-3 bg-[hsl(0,0%,6%)] border-b border-[hsl(0,0%,12%)]">
            <div className="p-4 md:p-6 text-sm font-semibold">{r.headerFeature[lang]}</div>
            <div className="p-4 md:p-6 text-sm font-semibold text-[hsl(0,0%,45%)] text-center border-x border-[hsl(0,0%,12%)]">{r.headerTraditional[lang]}</div>
            <div className="p-4 md:p-6 text-sm font-semibold text-center">
              <span className="text-accent">{r.headerQiai[lang]}</span>
            </div>
          </div>

          {/* Rows */}
          {r.rows.map((row, i) => (
            <div key={i} className={`grid grid-cols-3 ${i < r.rows.length - 1 ? "border-b border-[hsl(0,0%,10%)]" : ""} hover:bg-[hsl(0,0%,5%)] transition-colors duration-300`}>
              <div className="p-4 md:p-6 text-sm font-medium">{row.feature[lang]}</div>
              <div className="p-4 md:p-6 text-sm text-[hsl(0,0%,40%)] text-center border-x border-[hsl(0,0%,10%)] flex items-center justify-center gap-2">
                <X size={14} className="text-[hsl(0,70%,55%)] shrink-0" />
                <span className="hidden sm:inline">{row.traditional[lang]}</span>
              </div>
              <div className="p-4 md:p-6 text-sm text-center flex items-center justify-center gap-2">
                <Check size={14} className="text-accent shrink-0" />
                <span className="hidden sm:inline">{row.qiai[lang]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ComparisonSection;
