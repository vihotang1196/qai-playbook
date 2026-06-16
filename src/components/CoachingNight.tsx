import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";
import OthersVideoGallery from "@/components/coaching/OthersVideoGallery";
import { latestCoachingRecording } from "@/lib/coaching";

const CoachingNight = () => {
  const { lang, hideSubtitles } = useLang();

  return (
    <section id="coaching" className="py-24 md:py-32 bg-secondary/50">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
          {t.coaching.title[lang]}
        </h2>
        {!hideSubtitles && <p className="mt-2 text-muted-foreground">{t.coaching.subtitle[lang]}</p>}

        {/* Latest Recording */}
        <div
          id="coaching-replay"
          className="mt-10 rounded-2xl overflow-hidden bg-card border border-border scroll-mt-24"
        >
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border">
            <div>
              <span className="text-[10px] font-semibold tracking-widest uppercase bg-accent/20 text-accent-foreground px-2 py-0.5 rounded-full">
                {lang === "cn" ? "最新回放" : "Latest Replay"}
              </span>
              <h3 className="mt-2 text-lg font-semibold tracking-tight">
                Coaching Night — {latestCoachingRecording.date}
              </h3>
            </div>
            <Button
              variant="accent"
              size="sm"
              onClick={() => window.open(latestCoachingRecording.url, "_blank")}
            >
              <Play size={14} />
              {t.coaching.watch[lang]}
            </Button>
          </div>
          <div className="aspect-video bg-foreground/5">
            <video
              src={latestCoachingRecording.url}
              controls
              autoPlay
              muted
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Others Video Gallery */}
        <OthersVideoGallery />
      </div>
    </section>
  );
};

export default CoachingNight;
