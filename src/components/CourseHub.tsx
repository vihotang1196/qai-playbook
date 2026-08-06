import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";
import { courses } from "@/lib/courses";
import CoursePlayer from "@/components/CoursePlayer";

/**
 * Course Hub — the player lives on the page now.
 *
 * It used to be a 2×2 grid of cover cards, each opening the same player inside a
 * Dialog. The cards were a menu in front of a menu: the player already carries a
 * course switcher and a full curriculum, so the grid only added a click and a
 * modal. Inline, the first lesson of the first course is one click away.
 *
 * Note this section got SHORTER, not taller: the card grid was 939px of 16:9
 * covers (measured, 1440px viewport), and the whole section was 1373px.
 *
 * `id="courses"` is unchanged on purpose — GuidedTour scrolls here with
 * getElementById("courses"). (Featured Courses used to be the other caller;
 * that section is gone.)
 */
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

        <div className="mt-12">
          <CoursePlayer courses={courses} />
        </div>
      </div>
    </section>
  );
};

export default CourseHub;
