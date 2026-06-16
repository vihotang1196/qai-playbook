import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";


const tags = ["NEW", "NEW", null, null];

const FeaturedCourses = () => {
  const { lang, hideSubtitles } = useLang();
  const courses = t.featured.courses;
  const scrollRef = useRef<HTMLDivElement>(null);

  const pausedRef = useRef(false);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let direction = 1;
    let rafId = 0;
    let lastTime = performance.now();
    const speedPerSec = 40; // px per second

    const applyTransforms = () => {
      const cards = container.children;
      const containerRect = container.getBoundingClientRect();
      const centerX = containerRect.left + containerRect.width / 2;

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i] as HTMLElement;
        const cardRect = card.getBoundingClientRect();
        const cardCenterX = cardRect.left + cardRect.width / 2;
        const offset = (cardCenterX - centerX) / (containerRect.width / 2);
        const clampedOffset = Math.max(-1.2, Math.min(1.2, offset));

        const rotateY = clampedOffset * -12;
        const translateZ = (1 - Math.abs(clampedOffset)) * 20;
        const scale = 1 - Math.abs(clampedOffset) * 0.06;

        card.style.transform = `perspective(1200px) rotateY(${rotateY}deg) translateZ(${translateZ}px) scale(${scale})`;
      }
    };

    applyTransforms();

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (!pausedRef.current) {
        const maxScroll = container.scrollWidth - container.clientWidth;
        if (maxScroll > 1) {
          container.scrollLeft += speedPerSec * direction * dt;

          if (container.scrollLeft >= maxScroll - 1) {
            container.scrollLeft = maxScroll - 1;
            direction = -1;
          } else if (container.scrollLeft <= 1) {
            container.scrollLeft = 1;
            direction = 1;
          }

          applyTransforms();
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  const handleClick = (i: number) => {
    document.getElementById("courses")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="featured" className="vision-section py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <span className="vision-chip">Featured</span>
        <h2 className="mt-5 text-3xl md:text-4xl font-semibold tracking-tight">
          {t.featured.title[lang]}
        </h2>
        {!hideSubtitles && <p className="mt-3 text-muted-foreground">{t.featured.subtitle[lang]}</p>}
      </div>

      <div
        ref={scrollRef}
        className="mt-12 flex gap-6 overflow-x-auto px-6 pb-4 max-w-7xl mx-auto"
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {courses.map((course, i) => (
          <div
            key={i}
            onClick={() => handleClick(i)}
            className="shrink-0 w-72 md:w-80 vision-panel p-6 group cursor-pointer"
            style={{
              transition: "transform 0.15s ease-out",
              willChange: "transform",
            }}
          >
            <div className="h-40 rounded-xl bg-secondary mb-5 flex items-center justify-center overflow-hidden">
              {i === 0 ? (
                <img src="https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69bb6ab3dac58434d5e1ff3d.png" alt="广告设计" className="w-full h-full object-cover" />
              ) : i === 1 ? (
                <img src="https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69bb6abc3147fdd3fd4ebdef.png" alt="广告设置" className="w-full h-full object-cover" />
              ) : i === 2 ? (
                <img src="https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69bb6ac23147fd285c4ebe99.png" alt="成交策略" className="w-full h-full object-cover" />
              ) : i === 3 ? (
                <img src="https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69bb99cd7e33ef7b076adef6.png" alt="文案攻略" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-muted-foreground/20">
                  {String(i + 1).padStart(2, "0")}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mb-3">
              {tags[i] && (
                <span className="text-[10px] font-semibold tracking-widest uppercase bg-accent/15 text-accent-foreground px-2 py-0.5 rounded-full">
                  {tags[i]}
                </span>
              )}
            </div>

            <h3 className="text-lg font-semibold tracking-tight">{course.title[lang]}</h3>
            {!hideSubtitles && <p className="mt-1 text-sm text-muted-foreground">{course.desc[lang]}</p>}

            <Button
              variant="ghost"
              size="sm"
              className="mt-4 px-0 text-foreground group-hover:text-accent-foreground"
            >
              {t.featured.explore[lang]}
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FeaturedCourses;
