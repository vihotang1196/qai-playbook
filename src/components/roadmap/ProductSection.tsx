import { MessageSquare, Brain, Smartphone, Eye } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";

const featureIcons = [MessageSquare, Brain, Smartphone, Eye];

const ProductSection = () => {
  const { lang } = useLang();
  const r = t.roadmap.product;

  return (
    <section className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(0,0%,15%)] to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Chat mockup - dark glass UI */}
          <div className="relative">
            <div className="absolute -inset-4 bg-accent/5 rounded-3xl blur-2xl" />
            <div className="relative rounded-2xl border border-[hsl(0,0%,12%)] bg-[hsl(0,0%,6%)] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl">
              {/* Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-[hsl(0,0%,12%)] mb-4">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="text-sm font-bold">Q</span>
                </div>
                <div>
                  <p className="text-sm font-semibold">{r.chatHeader[lang]}</p>
                  <p className="text-xs text-accent">{r.chatOnline[lang]}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-4">
                <div className="flex justify-end">
                  <div className="bg-[hsl(0,0%,12%)] rounded-2xl rounded-tr-md px-4 py-3 max-w-[75%]">
                    <p className="text-sm">{r.chatMsg1[lang]}</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-accent/10 border border-accent/20 rounded-2xl rounded-tl-md px-4 py-3 max-w-[75%]">
                    <p className="text-xs text-accent font-medium mb-1">{r.chatAiLabel[lang]}</p>
                    <p className="text-sm">{r.chatReply1[lang]}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-[hsl(0,0%,12%)] rounded-2xl rounded-tr-md px-4 py-3 max-w-[75%]">
                    <p className="text-sm">{r.chatMsg2[lang]}</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-accent/10 border border-accent/20 rounded-2xl rounded-tl-md px-4 py-3 max-w-[75%]">
                    <p className="text-xs text-accent font-medium mb-1">{r.chatAiLabel[lang]}</p>
                    <p className="text-sm">{r.chatReply2[lang]}</p>
                  </div>
                </div>
              </div>

              {/* Input */}
              <div className="mt-4 flex items-center gap-2 pt-4 border-t border-[hsl(0,0%,12%)]">
                <div className="flex-1 h-10 rounded-xl bg-[hsl(0,0%,10%)] px-4 flex items-center">
                  <p className="text-sm text-[hsl(0,0%,40%)]">{r.chatComposing[lang]}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                  <MessageSquare size={16} className="text-accent-foreground" />
                </div>
              </div>
            </div>
          </div>

          {/* Features list */}
          <div>
            <p className="text-sm font-medium tracking-widest text-accent uppercase mb-4">{r.label[lang]}</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 whitespace-pre-line">
              {r.title[lang]}
            </h2>
            <p className="text-[hsl(0,0%,55%)] text-lg leading-relaxed mb-12">
              {r.subtitle[lang]}
            </p>

            <div className="space-y-6">
              {r.features.map((f, i) => {
                const Icon = featureIcons[i];
                return (
                  <div key={i} className="flex gap-4 group">
                    <div className="w-10 h-10 rounded-lg bg-[hsl(0,0%,10%)] flex items-center justify-center shrink-0 group-hover:bg-accent/10 transition-colors duration-300">
                      <Icon size={18} />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{f.title[lang]}</h3>
                      <p className="text-sm text-[hsl(0,0%,55%)] leading-relaxed">{f.desc[lang]}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductSection;
