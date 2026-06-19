import { BookOpen, Mic, Rocket, Share2 } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";

const icons = [BookOpen, Mic, Rocket, Share2];

// VisionOS-inspired accent gradients per app panel
const panelGradients = [
  "from-[#FF7E5F]/70 via-[#FF6A87]/50 to-[#FF3D6E]/60",
  "from-[#FF3D6E]/70 via-[#FF7E9E]/50 to-[#FFB199]/55",
  "from-[#FFB199]/65 via-[#FF9A8B]/50 to-[#FF3D6E]/60",
  "from-[#F59E0B]/55 via-[#FF7E5F]/55 to-[#FF3D6E]/65",
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
            background: "rgba(255,255,255,0.45)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.5)",
            boxShadow: "0 4px 24px rgba(74,144,226,0.08)",
          }}
        >
          Start Here
        </span>

        <h2 className="mt-6 text-4xl md:text-5xl font-semibold tracking-tight text-[#111827]">
          {t.startHere.title[lang]}
        </h2>
        {!hideSubtitles && (
          <p className="mt-4 text-base md:text-lg text-[#6B7280] max-w-2xl mx-auto">
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
                  background: "rgba(255,255,255,0.45)",
                  backdropFilter: "blur(30px) saturate(180%)",
                  WebkitBackdropFilter: "blur(30px) saturate(180%)",
                  border: "1px solid rgba(255,255,255,0.5)",
                  boxShadow:
                    "0 10px 40px rgba(17,24,39,0.06), inset 0 1px 0 rgba(255,255,255,0.6)",
                }}
              >
                {/* Inner glow on hover */}
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-[32px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(120% 80% at 50% 0%, rgba(139,92,246,0.10), transparent 60%)",
                  }}
                />

                {/* App icon — gradient glass tile */}
                <div className="relative">
                  <div
                    className={`w-16 h-16 rounded-[20px] flex items-center justify-center bg-gradient-to-br ${panelGradients[i]} transition-transform duration-500 group-hover:scale-[1.04]`}
                    style={{
                      boxShadow:
                        "0 8px 24px rgba(74,144,226,0.25), inset 0 1px 0 rgba(255,255,255,0.6)",
                    }}
                  >
                    <Icon size={26} strokeWidth={1.75} className="text-white drop-shadow-sm" />
                  </div>
                  {/* Tiny floating dot */}
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-white/80 shadow-sm" />
                </div>

                <div className="mt-6 relative">
                  <span className="text-[10px] font-semibold tracking-[0.18em] text-[#6B7280]">
                    STEP {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-[#111827]">
                    {step.title[lang]}
                  </h3>
                  {!hideSubtitles && (
                    <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
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
