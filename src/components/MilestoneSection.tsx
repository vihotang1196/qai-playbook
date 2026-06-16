import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Clock, Rocket, Star, ExternalLink } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

const phaseIcons = [Check, Clock, Rocket];

// Links for phase items (hover preview)
const phaseCtaLinks: Record<number, string> = {
  1: "https://chat.whatsapp.com/GrVKU7wl9LuDpYeg3ycTFt",
  2: "https://qiai.notion.site/27528b270a6d80b98cc9d45e0e6da90e?v=27528b270a6d813285ac000caaded827",
};
const itemLinks: Record<number, Record<number, string>> = {
  0: {
    0: "https://qiai.notion.site/AI-Agents-Conversation-AI-Conversation-AI-2a328b270a6d80cb890cd9a5643b71c4",
    1: "https://qiai.notion.site/Linking-Your-WhatsApp-27528b270a6d81608bb1d9b395e00770",
    2: "https://qiai.notion.site/Contacts-Bulk-Actions-Add-Contact-27928b270a6d80f098a3e4c9d10f4977",
    3: "https://qiai.notion.site/Conversations-Conversation-Contact-Details-28d28b270a6d8019a9cad80ba4e6a75c",
  },
  1: {
    0: "https://qiai.notion.site/AI-Agents-Conversation-AI-Conversation-AI-2a328b270a6d80cb890cd9a5643b71c4",
  },
};

const MilestoneSection = () => {
  const { lang, hideSubtitles } = useLang();
  const r = t.roadmap.timeline;

  return (
    <section id="milestone" className="vision-section py-24 md:py-32">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="vision-chip mb-5">{r.label[lang]}</span>
          <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight text-foreground">
            {r.title[lang]}
          </h2>
        </div>

        {/* Timeline */}
        <div className="relative">
          <div className="absolute left-6 md:left-8 top-0 bottom-0 w-px bg-gradient-to-b from-accent via-accent/30 to-transparent" />

          <div className="space-y-10">
            {r.phases.map((phase, i) => {
              const Icon = phaseIcons[i];
              const dotColors = ["bg-accent", "bg-accent/60", "bg-accent/30", "bg-muted-foreground/30"];
              return (
                <div key={i} className="relative pl-16 md:pl-20 group">
                  <div className={`absolute left-4 md:left-6 w-4 h-4 rounded-full ${dotColors[i]} ring-4 ring-background`} />

                  <div className="vision-panel p-6 hover:border-accent/30 transition-all duration-500">
                    <div className="flex items-center gap-3 mb-3">
                      <Icon size={16} className="text-accent" />
                      <span className="text-xs font-medium tracking-widest text-accent uppercase">{phase.label[lang]}</span>
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-3">{phase.title[lang]}</h3>
                    {!hideSubtitles && (
                      <ul className="space-y-2">
                        {phase.items.map((item, j) => {
                          const link = itemLinks[i]?.[j];
                          if (link) {
                            return (
                              <HoverCard key={j} openDelay={200} closeDelay={300}>
                                <HoverCardTrigger asChild>
                                  <li
                                    className="flex items-center gap-3 text-sm text-muted-foreground cursor-pointer hover:text-accent transition-colors group/item"
                                    onClick={() => window.open(link, "_blank")}
                                  >
                                    <span className="w-1 h-1 rounded-full bg-accent/50 mt-0 shrink-0 group-hover/item:bg-accent transition-colors" />
                                    <span className="underline decoration-dotted underline-offset-4 decoration-accent/30 group-hover/item:decoration-accent">
                                      {item[lang]}
                                    </span>
                                    <ExternalLink size={12} className="opacity-0 group-hover/item:opacity-60 transition-opacity shrink-0" />
                                  </li>
                                </HoverCardTrigger>
                                <HoverCardContent
                                  side="right"
                                  align="start"
                                  sideOffset={16}
                                  className="w-[420px] h-[300px] p-0 overflow-hidden rounded-xl border border-border/50 shadow-xl"
                                >
                                  <div className="w-full h-full bg-background">
                                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/30">
                                      <div className="w-2 h-2 rounded-full bg-accent/60" />
                                      <span className="text-xs text-muted-foreground truncate">{item[lang]}</span>
                                    </div>
                                    <iframe
                                      src={link}
                                      className="w-full border-0"
                                      style={{ height: "calc(100% - 32px)" }}
                                      title={item[lang]}
                                      sandbox="allow-scripts allow-same-origin"
                                    />
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                            );
                          }
                          return (
                            <li key={j} className="flex items-start gap-3 text-sm text-muted-foreground">
                              <span className="w-1 h-1 rounded-full bg-accent/50 mt-2 shrink-0" />
                              {item[lang]}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {"cta" in phase && phase.cta && (
                      <div className="mt-5 pt-4 border-t border-border/50">
                        <p className="text-sm text-muted-foreground mb-3">{r.phaseCta[lang]}</p>
                        <Button
                          variant="accent"
                          size="lg"
                          onClick={() => window.open(phaseCtaLinks[i] || "https://chat.whatsapp.com/GrVKU7wl9LuDpYeg3ycTFt", "_blank")}
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

export default MilestoneSection;
