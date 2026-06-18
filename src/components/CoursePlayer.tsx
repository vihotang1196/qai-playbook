import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Maximize, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import type { Course } from "@/lib/courses";

interface Lesson {
  title: string;
  url: string;
  /** flat index across all parts */
  index: number;
}

const formatTime = (s: number): string => {
  if (!isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

/**
 * Course playback view: left video player (~65%) + right curriculum
 * sidebar (~35%). Designed to live inside a Dialog. Plays with sound,
 * highlights the active lesson, and auto-advances to the next lesson when
 * one finishes.
 */
const CoursePlayer = ({ course }: { course: Course }) => {
  const { lang } = useLang();

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const listItemRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  // When true, the next loaded video should start playing automatically
  // (set on lesson click and on auto-advance, NOT on first mount).
  const autoplayRef = useRef(false);

  const active = lessons[activeIndex] ?? lessons[0];

  // Switching course → restart from the first lesson, no autoplay.
  useEffect(() => {
    setActiveIndex(0);
    autoplayRef.current = false;
  }, [course]);

  // Reset transient playback state whenever the active lesson changes.
  useEffect(() => {
    setProgress(0);
    setDuration(0);
    setIsPlaying(false);
  }, [activeIndex]);

  // Keep the active row visible in the sidebar.
  useEffect(() => {
    listItemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  const handlePlayToggle = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      el.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    setDuration(el.duration || 0);
    if (autoplayRef.current) {
      autoplayRef.current = false;
      el.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (el && el.duration) {
      setProgress(el.currentTime);
      setDuration(el.duration);
    }
  }, []);

  // Auto-advance to the next lesson when the current one ends.
  const handleEnded = useCallback(() => {
    setActiveIndex((i) => {
      if (i < lessons.length - 1) {
        autoplayRef.current = true;
        return i + 1;
      }
      setIsPlaying(false);
      return i;
    });
  }, [lessons.length]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = videoRef.current;
    const bar = progressRef.current;
    if (!el || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * duration;
  }, [duration]);

  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const next = !muted;
    el.muted = next;
    setMuted(next);
  }, [muted]);

  const goFullscreen = useCallback(() => {
    videoRef.current?.requestFullscreen?.();
  }, []);

  // User picked a lesson → switch and autoplay it.
  const selectLesson = useCallback((index: number) => {
    autoplayRef.current = true;
    setActiveIndex(index);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 lg:gap-6">
      {/* Left: player ~65% */}
      <div className="lg:col-span-7">
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-video group">
          <video
            key={active?.url}
            ref={videoRef}
            src={active?.url}
            poster={course.cover}
            muted={muted}
            playsInline
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onClick={handlePlayToggle}
            className="w-full h-full object-contain cursor-pointer bg-black"
          />

          {!isPlaying && (
            <button
              onClick={handlePlayToggle}
              className="absolute inset-0 flex items-center justify-center group/play"
              aria-label="Play"
            >
              <div className="w-20 h-20 rounded-full bg-white/25 backdrop-blur-md border border-white/40 flex items-center justify-center shadow-2xl transition-transform group-hover/play:scale-110">
                <Play size={36} className="text-white fill-white ml-1" />
              </div>
            </button>
          )}

          {/* Bottom controls */}
          <div
            className={`absolute bottom-0 left-0 right-0 flex flex-col transition-opacity duration-200 ${isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"}`}
          >
            <div
              ref={progressRef}
              className="w-full h-1.5 bg-white/20 cursor-pointer hover:h-2 transition-all"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-accent"
                style={{ width: duration ? `${(progress / duration) * 100}%` : "0%" }}
              />
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-t from-black/70 to-transparent">
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePlayToggle}
                  className="text-white hover:text-accent transition-colors p-1"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} className="fill-white" />}
                </button>
                <button
                  onClick={toggleMute}
                  className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur text-white rounded-full px-3 py-1 text-xs font-medium transition-colors"
                >
                  {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  {muted ? (lang === "cn" ? "点击取消静音" : "Tap to Unmute") : (lang === "cn" ? "静音" : "Mute")}
                </button>
                <span className="text-white/80 text-[11px] tabular-nums">
                  {formatTime(progress)} / {formatTime(duration)}
                </span>
              </div>
              <button
                onClick={goFullscreen}
                className="text-white hover:text-accent transition-colors p-1"
                aria-label="Fullscreen"
              >
                <Maximize size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 px-1">
          <p className="text-xs text-muted-foreground tracking-wide">
            {lang === "cn" ? "第" : "Lesson"} {activeIndex + 1} {lang === "cn" ? `/ ${totalVideos} 课` : `of ${totalVideos}`}
          </p>
          <h4 className="mt-1 text-base md:text-lg font-semibold tracking-tight text-foreground">
            {active?.title}
          </h4>
        </div>
      </div>

      {/* Right: curriculum sidebar ~35% */}
      <div className="lg:col-span-3">
        <div className="rounded-2xl bg-secondary/40 border border-border overflow-hidden flex flex-col max-h-[420px] lg:max-h-[560px]">
          <div className="p-4 border-b border-border">
            <h4 className="text-sm font-semibold tracking-tight text-foreground">
              {lang === "cn" ? "课程目录" : "Curriculum"}
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {moduleCount} {lang === "cn" ? "模块" : "modules"} · {totalVideos} {lang === "cn" ? "个视频" : "videos"}
            </p>
          </div>

          <div className="overflow-y-auto flex-1 py-2">
            {course.curriculum.map((part) => (
              <div key={part.part} className="px-2 pb-2">
                <div className="px-3 pt-3 pb-1.5">
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                    {part.part} · {part.title}
                  </p>
                </div>
                <div className="space-y-0.5">
                  {part.videos.map((v) => {
                    const lesson = lessons.find((l) => l.url === v.url && l.title === v.title);
                    const idx = lesson?.index ?? 0;
                    const isActive = idx === activeIndex;
                    return (
                      <button
                        key={idx}
                        ref={(el) => { listItemRefs.current[idx] = el; }}
                        onClick={() => selectLesson(idx)}
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoursePlayer;
