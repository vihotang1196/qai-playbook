import { BookOpen, Mic, Rocket, Share2 } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";

const icons = [BookOpen, Mic, Rocket, Share2];

// VisionOS-inspired accent gradients per app panel
const panelGradients = [
  "from-[#fed50a] via-[#fed50a] to-[#fed50a]",
  "from-[#fed50a] via-[#fed50a] to-[#fed50a]",
  "from-[#fed50a] via-[#fed50a] to-[#fed50a]",
  "from-[#fed50a] via-[#fed50a] to-[#fed50a]",
];

const StartHere = () => {
  const { lang, hideSubtitles } = useLang();

  return (
    <section
      id="start-here"
      className="relative py-28 md:py-36 overflow-hidden"
    >
      <div className="max-w-6xl mx-auto px-6 text-center">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-medium tracking-wider uppercase text-foreground/70"
          style={{
            background: "#ffffff",
            border: "2px solid #141414",
          }}
        >
          Start Here
        </span>

        <h2 className="mt-6 text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
          {t.startHere.title[lang]}
        </h2>
        {!hideSubtitles && (
          <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            {t.startHere.subtitle[lang]}
          </p>
        )}

        {/* Floating VisionOS app panels */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10">
          {t.startHere.steps.map((step, i) => {
            const Icon = icons[i];
            return (
              <div
                key={i}
                className="group relative rounded-[32px] p-7 text-left transition-all duration-500 ease-out hover:-translate-y-1.5"
                style={{
                  background: "#ffffff",
                  border: "2px solid #141414",
                  boxShadow: "6px 6px 0 #141414",
                }}
              >
                {/* Inner glow on hover */}
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-[32px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: "transparent",
                  }}
                />

                {/* App icon — gradient glass tile */}
                <div className="relative">
                  <div
                    className={`w-16 h-16 rounded-[20px] flex items-center justify-center bg-gradient-to-br ${panelGradients[i]} transition-transform duration-500 group-hover:scale-[1.04]`}
                    style={{
                      boxShadow: "none",
                    }}
                  >
                    <Icon size={26} strokeWidth={1.75} className="text-[#141414]" />
                  </div>
                  {/* Tiny floating dot */}
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#141414]" />
                </div>

                <div className="mt-6 relative">
                  <span className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                    STEP {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                    {step.title[lang]}
                  </h3>
                  {!hideSubtitles && (
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {step.desc[lang]}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default StartHere;
