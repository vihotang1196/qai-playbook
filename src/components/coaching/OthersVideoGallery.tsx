import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { ChevronDown, Maximize, Play, X, Volume2, VolumeX } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import nurtureOs15Jun from "@/assets/nurture-os-15jun.png.asset.json";

interface RawVideo {
  title: string;
  url: string;
  thumbnail?: string;
}

const rawVideos: RawVideo[] = [
  { title: "15 June 2026", url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/6a30fc59998928ce1fdb43b7.mp4", thumbnail: nurtureOs15Jun.url },
  { title: "20 April 2026", url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/69e98e3aa48992f689c61d73.mp4" },
  { title: "13 April 2026", url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/69e2772fc87cb8c801751721.mp4" },
  { title: "06 April 2026", url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/69d8773d982fd67a3503cf32.mp4" },
  { title: "30 March 2026", url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/69cb4c49ca19f8860fb38633.mov" },
  { title: "24 March 2026", url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/69c1ff683b3a5858e017f7c6.mp4" },
  { title: "16 March 2026", url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/69b8f74f5b89c77c52e411e1.mp4" },
  { title: "02 March 2026", url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/69ba1b5d9c981762ebd84d90.mp4" },
  { title: "2 February 2026", url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/69ba1b5d61cba53db0a02e89.mp4" },
  { title: "26 January 2026", url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/69ba1b5d9c9817a268d84d8f.mp4" },
  { title: "20 January 2026", url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/69ba1b5d9c98175f17d84d8a.mp4" },
  { title: "19 January 2026", url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/69ba1b5d9ab5e208677020c3.mp4" },
  { title: "23 December 2025", url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/69ba1b5d61cba50652a02e8d.mp4" },
  { title: "22 December 2025", url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/69ba1b5d9ab5e2fd547020c2.mp4" },
  { title: "9 December 2025", url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/69ba1b5ddac5841ff6b656f5.mp4" },
  { title: "8 December 2025", url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/69ba1b5ddac584d432b656ed.mp4" },
];

const MONTHS: Record<string, number> = { january:0, february:1, march:2, april:3, may:4, june:5, july:6, august:7, september:8, october:9, november:10, december:11 };
const parseDate = (title: string): Date | null => {
  const m = title.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  if (!m) return null;
  return new Date(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
};
const formatTitle = (title: string): string => {
  const m = title.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  if (!m) return title;
  return `${m[1].padStart(2,"0")} ${m[2].toUpperCase()} ${m[3]}`;
};

// 转化 anchor: Mon June 15 2026 → 转化. Alternating weekly.
const ANCHOR = new Date(2026, 5, 15);
const getTopic = (date: Date): "转化" | "流量" => {
  const weeks = Math.floor((date.getTime() - ANCHOR.getTime()) / (7 * 86400000));
  const mod = ((weeks % 2) + 2) % 2;
  return mod === 0 ? "转化" : "流量";
};

interface VideoItem extends RawVideo {
  id: number;
  date: Date;
  topic: "转化" | "流量";
  displayTitle: string;
}

const videos: VideoItem[] = rawVideos
  .map((v, i) => {
    const d = parseDate(v.title) ?? new Date(0);
    return { ...v, id: i + 1, date: d, topic: getTopic(d), displayTitle: formatTitle(v.title) };
  })
  .sort((a, b) => b.date.getTime() - a.date.getTime());

const PARTS: { key: "转化" | "流量"; label: string; sub: string }[] = [
  { key: "转化", label: "PART 1", sub: "转化" },
  { key: "流量", label: "PART 2", sub: "流量" },
];

const OthersVideoGallery = () => {
  const { lang } = useLang();
  const [expanded, setExpanded] = useState(true);
  const [activeId, setActiveId] = useState<number>(videos[0]?.id ?? 1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const listItemRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const active = useMemo(() => videos.find(v => v.id === activeId) ?? videos[0], [activeId]);

  const grouped = useMemo(() => {
    return PARTS.map(p => ({ ...p, items: videos.filter(v => v.topic === p.key) }));
  }, []);

  // When switching video, reset state
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
  }, [activeId]);

  // Scroll active row into view
  useEffect(() => {
    const node = listItemRefs.current[activeId];
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

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

  const handleTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (el && el.duration) {
      setProgress(el.currentTime);
      setDuration(el.duration);
    }
  }, []);

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

  const totalVideos = videos.length;

  return (
    <div className="mt-6 rounded-2xl overflow-hidden bg-card border border-border scroll-mt-24">
      <div
        className={`p-5 flex items-center justify-between cursor-pointer ${expanded ? "border-b border-border" : ""}`}
        onClick={() => setExpanded(prev => !prev)}
      >
        <div className="flex items-center gap-3">
          <ChevronDown
            size={18}
            className={`text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
          <div>
            <span className="text-[10px] font-semibold tracking-widest uppercase bg-accent/20 text-accent-foreground px-2 py-0.5 rounded-full">
              {lang === "cn" ? "回放" : "Replay"}
            </span>
            <h3 className="mt-2 text-lg font-semibold tracking-tight">
              {lang === "cn" ? "Coaching Night 回放" : "Coaching Night Replays"}
            </h3>
          </div>
        </div>
      </div>

      {expanded && active && (
        <div className="p-4 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 lg:gap-6">
            {/* Left: Player ~70% */}
            <div className="lg:col-span-7">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video group">
                <video
                  key={active.url}
                  ref={videoRef}
                  src={active.url}
                  poster={active.thumbnail}
                  muted={muted}
                  playsInline
                  preload="metadata"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleTimeUpdate}
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
                    <button
                      onClick={toggleMute}
                      className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur text-white rounded-full px-3 py-1 text-xs font-medium transition-colors"
                    >
                      {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      {muted ? "Tap to Unmute" : "Mute"}
                    </button>
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
                  {active.topic} · {active.displayTitle}
                </p>
                <h4 className="mt-1 text-base md:text-lg font-semibold tracking-tight text-foreground">
                  {lang === "cn" ? `${active.topic} 主题分享` : `${active.topic} Session`}
                </h4>
              </div>
            </div>

            {/* Right: Curriculum sidebar ~30% */}
            <div className="lg:col-span-3">
              <div className="rounded-2xl bg-secondary/40 border border-border overflow-hidden flex flex-col max-h-[560px]">
                <div className="flex items-start justify-between p-4 border-b border-border">
                  <div>
                    <h4 className="text-sm font-semibold tracking-tight text-foreground">
                      {lang === "cn" ? "课程目录" : "Curriculum"}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {grouped.length} {lang === "cn" ? "模块" : "modules"} · {totalVideos} {lang === "cn" ? "个视频" : "videos"}
                    </p>
                  </div>
                  <button
                    onClick={() => setExpanded(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1 -mt-1"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 py-2">
                  {grouped.map(part => (
                    <div key={part.key} className="px-2 pb-2">
                      <div className="px-3 pt-3 pb-1.5">
                        <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                          {part.label} · {part.sub}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        {part.items.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-muted-foreground/70">
                            {lang === "cn" ? "暂无视频" : "No videos"}
                          </p>
                        ) : (
                          part.items.map(v => {
                            const isActive = v.id === activeId;
                            return (
                              <button
                                key={v.id}
                                ref={el => { listItemRefs.current[v.id] = el; }}
                                onClick={() => setActiveId(v.id)}
                                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all ${
                                  isActive
                                    ? "bg-accent/10 ring-1 ring-accent/40"
                                    : "hover:bg-foreground/5"
                                }`}
                              >
                                <span
                                  className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                                    isActive ? "bg-accent text-accent-foreground" : "bg-foreground/10 text-foreground/60"
                                  }`}
                                >
                                  <Play size={11} className="fill-current ml-px" />
                                </span>
                                <span className={`text-xs font-medium tracking-tight truncate ${isActive ? "text-foreground" : "text-foreground/80"}`}>
                                  {v.displayTitle}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OthersVideoGallery;
