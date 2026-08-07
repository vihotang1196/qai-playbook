import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Play } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import type { Course } from "@/lib/courses";
import VideoPlayer from "@/components/video/VideoPlayer";

interface Lesson {
  title: string;
  url: string;
  /** flat index across all parts */
  index: number;
}

/**
 * Course playback view: player + course switcher strip on the left, curriculum
 * sidebar on the right. Renders inline on the page (it used to sit in a Dialog
 * opened from a grid of cover cards; both are gone).
 *
 * Playback itself — Brutalist controls, preload="none", the 300ms dwell, muted
 * autoplay on view, pause-on-exit — all lives in the shared <VideoPlayer>. What
 * is course-specific stays here: the flattened lesson list, auto-advance, the
 * module accordion, and the rule below about what a course switch means.
 *
 * SWITCHING COURSE DOES NOT START PLAYBACK — the one place this behaves
 * differently from Coaching Night. Picking a course says "show me this", not
 * "start streaming this": it lands on lesson 1, paused, showing the course
 * cover. Clicking a lesson plays. That is exactly what `playToken` expresses —
 * a src change alone is not a request to play, a token bump is.
 */
type CoursePlayerProps = {
  /** All selectable courses. A single entry hides the switcher strip — there is
   *  nothing to switch between, and the strip would just be a label. */
  courses: Course[];
  initialCourseId?: string;
};

/** lg breakpoint. Desktop shows every module expanded and scrolls the sidebar
 *  inside a fixed frame; on a phone that same list is ~1000px of column under a
 *  156px video, and a nested scroll area there would fight the page scroll — so
 *  it collapses to the module being watched instead. */
const useIsDesktop = () => {
  const query = "(min-width: 1024px)";
  const [is, setIs] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setIs(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return is;
};

const CoursePlayer = ({ courses, initialCourseId }: CoursePlayerProps) => {
  const { lang } = useLang();
  const isDesktop = useIsDesktop();
  const [courseId, setCourseId] = useState(initialCourseId ?? courses[0]?.id);
  const course = courses.find((c) => c.id === courseId) ?? courses[0];

  // Flatten the curriculum into an ordered lesson list (for indexing /
  // auto-advance) while keeping the grouped shape for the sidebar.
  const lessons: Lesson[] = useMemo(() => {
    const out: Lesson[] = [];
    let idx = 0;
    course.curriculum.forEach((p) =>
      p.videos.forEach((v) => out.push({ title: v.title, url: v.url, index: idx++ }))
    );
    return out;
  }, [course]);

  const totalVideos = lessons.length;
  const moduleCount = course.curriculum.length;

  const [activeIndex, setActiveIndex] = useState(0);
  /** Bumped only when playback is actually being asked for: a lesson click or an
   *  auto-advance. Never on a course switch — see the note at the top. */
  const [playToken, setPlayToken] = useState(0);
  const listItemRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  /** The scrolling frame around the curriculum list. Needed because keeping the
   *  active row visible is done by setting THIS element's scrollTop — see the
   *  effect below for why scrollIntoView cannot be used here. */
  const listRef = useRef<HTMLDivElement>(null);
  /** Previous activeIndex, or null on the very first run. See the effect below. */
  const prevIndexRef = useRef<number | null>(null);

  const active = lessons[activeIndex] ?? lessons[0];

  // Switching course → back to lesson 1, and NO token bump, so it stays paused.
  useEffect(() => {
    setActiveIndex(0);
  }, [course]);

  /** Which module is expanded on mobile. Follows the lesson being played, so
   *  picking a course or auto-advancing never leaves the list closed on the
   *  thing that is on screen. */
  const activePart = useMemo(() => {
    let seen = 0;
    for (const p of course.curriculum) {
      if (activeIndex < seen + p.videos.length) return p.part;
      seen += p.videos.length;
    }
    return course.curriculum[0]?.part;
  }, [course, activeIndex]);
  const [openPart, setOpenPart] = useState<string | undefined>(undefined);
  useEffect(() => setOpenPart(activePart), [activePart]);

  /**
   * Keep the active row visible in the sidebar — WITHOUT ever scrolling the page.
   *
   * This used to be `scrollIntoView({ block: "nearest" })`, which moved the whole
   * document. Two separate bugs came out of that, and both are fixed here:
   *
   * 1. `nearest` does NOT mean "only scroll inside the container". It means
   *    "scroll the minimum distance needed to make this visible" — and when the
   *    target is outside the VIEWPORT, that walks every scrollable ancestor up
   *    to the document. Opening the homepage dragged the reader down to y≈2391,
   *    because this effect also runs on mount and the list is far below the
   *    fold. Setting the frame's own scrollTop is the only way to stay inside it.
   *
   * 2. It ran on mount at all. Nothing has been *chosen* on the first pass, so
   *    there is nothing to reveal; `prevIndexRef === null` skips it. Without
   *    this, a course whose lesson 1 sits below the frame's fold would still
   *    yank the list on arrival.
   *
   * Both matter. Fixing only (2) would leave clicking lesson 15 quietly scrolling
   * the page — the same bug, but arriving as "the page jumped when I picked a
   * lesson", which is much harder to trace back here.
   *
   * On phones the frame has no height constraint (see useIsDesktop), so
   * scrollHeight === clientHeight, both branches are false and this is a no-op —
   * which is correct: there the list flows in the page and must not be moved.
   */
  useEffect(() => {
    const prev = prevIndexRef.current;
    prevIndexRef.current = activeIndex;
    if (prev === null) return; // first run — see 2 above

    const frame = listRef.current;
    const item = listItemRefs.current[activeIndex];
    if (!frame || !item) return;

    // Offsets via getBoundingClientRect rather than offsetTop: offsetTop is
    // measured from the offsetParent, which on lg is the absolutely-positioned
    // outer frame, not this scrolling div.
    const itemRect = item.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const itemTop = itemRect.top - frameRect.top + frame.scrollTop;
    const itemBottom = itemTop + itemRect.height;
    const viewTop = frame.scrollTop;
    const viewBottom = viewTop + frame.clientHeight;

    if (itemTop < viewTop) frame.scrollTop = itemTop;
    else if (itemBottom > viewBottom) frame.scrollTop = itemBottom - frame.clientHeight;
  }, [activeIndex]);

  /** A viewer picked this lesson, so play it. */
  const selectLesson = useCallback((index: number) => {
    setActiveIndex(index);
    setPlayToken((n) => n + 1);
  }, []);

  /** Roll on to the next lesson when one finishes; stop at the end. */
  const onEnded = useCallback(() => {
    if (activeIndex >= lessons.length - 1) return;
    setActiveIndex(activeIndex + 1);
    setPlayToken((n) => n + 1);
  }, [activeIndex, lessons.length]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 lg:gap-6">
      {/* Left: player ~65% */}
      <div className="lg:col-span-7">
        <VideoPlayer
          src={active?.url ?? ""}
          poster={course.cover}
          autoPlayOnView
          playToken={playToken}
          onEnded={onEnded}
          lang={lang}
        />

        <div className="mt-3 px-1">
          <p className="text-xs text-muted-foreground tracking-wide">
            {lang === "cn" ? "第" : "Lesson"} {activeIndex + 1} {lang === "cn" ? `/ ${totalVideos} 课` : `of ${totalVideos}`}
          </p>
          <h4 className="mt-1 text-base md:text-lg font-semibold tracking-tight text-foreground">
            {active?.title}
          </h4>
        </div>

        {/* Course switcher — same language as Coaching Night's date strip:
            horizontal, scrollable, yellow fill on the selected one. */}
        {courses.length > 1 && (
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {courses.map((c) => {
              const on = c.id === course.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCourseId(c.id)}
                  aria-current={on ? "true" : undefined}
                  className={`shrink-0 rounded-xl border-2 border-[#141414] px-7 py-5 text-left transition-[transform,box-shadow] duration-150 ${
                    on
                      ? "bg-[#fed50a] shadow-[4px_4px_0_#141414]"
                      : "bg-white hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[4px_4px_0_#141414]"
                  }`}
                >
                  <span className="block whitespace-nowrap text-lg font-bold tracking-tight text-foreground">
                    {c.title[lang]}
                  </span>
                  <span className="mt-1 block whitespace-nowrap text-xs font-medium text-muted-foreground">
                    {c.curriculum.length} {lang === "cn" ? "模块" : "modules"} ·{" "}
                    {c.curriculum.reduce((n, p) => n + p.videos.length, 0)} {lang === "cn" ? "课" : "lessons"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: curriculum sidebar ~35%.
          On lg the inner frame is absolutely positioned, so this column
          contributes no content height and the grid row is sized by the player
          alone — the sidebar then fills exactly that height and scrolls inside
          it. A `max-h` in px cannot do this: the player's height comes from its
          column width (aspect-video) and the list's from the course (481px for
          文案攻略, 1003px for 广告设计), so any fixed number is wrong somewhere.
          Below lg the absolute positioning is off and it flows normally. */}
      <div className="lg:col-span-3 lg:relative">
        <div className="rounded-2xl bg-secondary/40 border border-border overflow-hidden flex flex-col lg:absolute lg:inset-0">
          <div className="p-4 border-b border-border">
            <h4 className="text-sm font-semibold tracking-tight text-foreground">
              {lang === "cn" ? "课程目录" : "Curriculum"}
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {moduleCount} {lang === "cn" ? "模块" : "modules"} · {totalVideos} {lang === "cn" ? "个视频" : "videos"}
            </p>
          </div>

          <div ref={listRef} className="overflow-y-auto flex-1 py-2 min-h-0">
            {course.curriculum.map((part) => {
              const expanded = isDesktop || openPart === part.part;
              return (
                <div key={part.part} className="px-2 pb-2">
                  {/* Desktop: a plain heading, everything expanded. Mobile: the
                      heading is the toggle, and only one module is open. */}
                  <button
                    type="button"
                    onClick={() => !isDesktop && setOpenPart(expanded ? undefined : part.part)}
                    aria-expanded={isDesktop ? undefined : expanded}
                    className="flex w-full items-center justify-between gap-2 px-3 pt-3 pb-1.5 text-left lg:pointer-events-none"
                  >
                    <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                      {part.part} · {part.title}
                    </p>
                    <span className="shrink-0 text-[10px] font-semibold text-muted-foreground lg:hidden">
                      {expanded ? "−" : `+${part.videos.length}`}
                    </span>
                  </button>
                  <div className={`space-y-0.5 ${expanded ? "" : "hidden"}`}>
                    {part.videos.map((v) => {
                      const lesson = lessons.find((l) => l.url === v.url && l.title === v.title);
                      const idx = lesson?.index ?? 0;
                      const isActive = idx === activeIndex;
                      return (
                        <button
                          key={idx}
                          ref={(el) => { listItemRefs.current[idx] = el; }}
                          onClick={() => selectLesson(idx)}
                          // Back on the semantic token: --accent now resolves to
                          // #fed50a exactly, so there is no reason to hardcode it
                          // and lose the one place a brand colour can be changed.
                          className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all ${
                            isActive ? "bg-accent/10 ring-1 ring-accent/40" : "hover:bg-foreground/5"
                          }`}
                        >
                          <span
                            className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                              isActive ? "bg-accent text-accent-foreground" : "bg-foreground/10 text-foreground/60"
                            }`}
                          >
                            <Play size={11} className="fill-current ml-px" />
                          </span>
                          <span className={`text-xs font-medium tracking-tight line-clamp-2 ${isActive ? "text-foreground" : "text-foreground/80"}`}>
                            {v.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoursePlayer;
