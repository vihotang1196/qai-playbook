import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";
import { courses } from "@/lib/courses";
import CoursePlayer from "@/components/CoursePlayer";

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
          {t.courseHub.courses.map((course, i) => {
            const data = courses[i];
            return (
              <div key={i} className="vision-panel p-6">
                <div className="w-full aspect-video rounded-xl bg-secondary mb-5 overflow-hidden">
                  {data ? (
                    <img src={data.cover} alt={course.title[lang]} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-muted-foreground/20">{String(i + 1).padStart(2, "0")}</span>
                  )}
                </div>
                <h3 className="text-lg font-semibold tracking-tight">{course.title[lang]}</h3>
                {!hideSubtitles && <p className="mt-1 text-sm text-muted-foreground">{course.desc[lang]}</p>}

                {data ? (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="default" size="sm" className="mt-5 w-full">
                        {t.courseHub.start[lang]}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-6xl w-[95vw] p-0 gap-0 overflow-hidden">
                      <DialogHeader className="px-5 pt-5 pb-3 text-left">
                        <DialogTitle className="text-lg font-semibold tracking-tight">
                          {course.title[lang]}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="px-4 pb-5 md:px-5">
                        <CoursePlayer course={data} />
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Button variant="default" size="sm" className="mt-5 w-full">
                    {t.courseHub.start[lang]}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CourseHub;
