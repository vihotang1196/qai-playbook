import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";
import AdsDesignPopout from "@/components/AdsDesignPopout";
import AdsSettingsPopout from "@/components/AdsSettingsPopout";
import ClosingStrategyPopout from "@/components/ClosingStrategyPopout";
import CopywritingPopout from "@/components/CopywritingPopout";

const CourseHub = () => {
  const { lang, hideSubtitles } = useLang();

  return (
    <section id="courses" className="vision-section py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <span className="vision-chip">Course Hub</span>
        <h2 className="mt-5 text-3xl md:text-4xl font-semibold tracking-tight">
          {t.courseHub.title[lang]}
        </h2>
        {!hideSubtitles && <p className="mt-3 text-muted-foreground">{t.courseHub.subtitle[lang]}</p>}

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
          {t.courseHub.courses.map((course, i) => (
            <div
              key={i}
              className="vision-panel p-6"
            >
              <div className="w-full aspect-video rounded-xl bg-secondary mb-5 overflow-hidden">
                {i === 0 ? (
                  <img src="https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69bb6ab3dac58434d5e1ff3d.png" alt="广告设计" className="w-full h-full object-cover" />
                ) : i === 1 ? (
                  <img src="https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69bb6abc3147fdd3fd4ebdef.png" alt="广告设置" className="w-full h-full object-cover" />
                ) : i === 2 ? (
                  <img src="https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69bb6ac23147fd285c4ebe99.png" alt="成交策略" className="w-full h-full object-cover" />
                ) : i === 3 ? (
                  <img src="https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69bb99cd7e33ef7b076adef6.png" alt="文案攻略" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-muted-foreground/20">{String(i + 1).padStart(2, "0")}</span>
                )}
              </div>
              <h3 className="text-lg font-semibold tracking-tight">{course.title[lang]}</h3>
              {!hideSubtitles && <p className="mt-1 text-sm text-muted-foreground">{course.desc[lang]}</p>}

              {i === 0 ? (
                <AdsDesignPopout triggerLabel={t.courseHub.start[lang]} />
              ) : i === 1 ? (
                <AdsSettingsPopout triggerLabel={t.courseHub.start[lang]} />
              ) : i === 2 ? (
                <ClosingStrategyPopout triggerLabel={t.courseHub.start[lang]} />
              ) : i === 3 ? (
                <CopywritingPopout triggerLabel={t.courseHub.start[lang]} />
              ) : (
                <Button variant="default" size="sm" className="mt-5 w-full">
                  {t.courseHub.start[lang]}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CourseHub;
