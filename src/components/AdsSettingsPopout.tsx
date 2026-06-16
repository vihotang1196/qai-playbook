import { useState, useRef, useEffect, useCallback } from "react";
import type React from "react";
import { Play, Pause, ChevronRight, X, Volume2, VolumeX, Maximize } from "lucide-react";
import { cn } from "@/lib/utils";

const curriculum = [
  {
    part: "PART 1",
    title: "广告基础设定",
    videos: [
      { title: "为什么要花钱打广告?", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fa2c8d9b36ef404542.mp4" },
      { title: "广告设定基础", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fa45e39c492242eea2.mp4" },
      { title: "6个 广告目标 - Facebook Ads Campaign", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fadac584d63ebeb9b6.mp4" },
      { title: "广告实际操作", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fb15872b70f6af82c1.mp4" },
    ],
  },
  {
    part: "PART 2",
    title: "广告指标与管理",
    videos: [
      { title: "广告使用者 vs 购买者", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fa2c8d9b3541404541.mp4" },
      { title: "广告指标 - 知道你花的钱去了哪里", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fad3a72bf678137bff.mp4" },
      { title: "广告指标 Table", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fb15872bd739af82a7.mp4" },
      { title: "Facebook 广告出了问题 中 BANNED 要找谁？", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fa45e39c345442eea3.mp4" },
    ],
  },
  {
    part: "PART 3",
    title: "广告扩量与再营销",
    videos: [
      { title: "广告设置 Scaling 四部曲：A/B Test & CBO", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fa45e39cb36342eea4.mp4" },
      { title: "学会用 Retargeting Ads 做二次营销 获取最大的再次营销效益", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fadac5841c3abeb9b5.mp4" },
      { title: "如何根据你的客户列表设定相似受众群体 Lookalike Audience", url: "https://assets.cdn.filesafe.space/zUvmZ5aUG77DfLnXLzKo/media/69ba76fa15872b7f4baf829f.mp4" },
    ],
  },
];

const totalVideos = curriculum.reduce((s, p) => s + p.videos.length, 0);

interface AdsSettingsPopoutProps {
  triggerLabel: string;
}

const AdsSettingsPopout = ({ triggerLabel }: AdsSettingsPopoutProps) => {
  const [listOpen, setListOpen] = useState(false);
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedRef = useRef(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (lockedRef.current) return;
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setListOpen(false);
        setHoveredVideo(null);
      }
    };
    if (listOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [listOpen]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setIsPlaying(false);
    setProgress(0);
    setMuted(true);
    v.muted = true;
  }, [hoveredVideo]);

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgress((v.currentTime / v.duration) * 100);
  }, []);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    v.currentTime = ratio * v.duration;
    setProgress(ratio * 100);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) lockedRef.current = true;
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setIsPlaying(true); lockedRef.current = true; }
    else { v.pause(); setIsPlaying(false); }
  };

  const goFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen();
  };

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const scheduleClose = () => {
    if (lockedRef.current) return;
    cancelClose();
    closeTimer.current = setTimeout(() => {
      setListOpen(false);
      setHoveredVideo(null);
    }, 350);
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      {/* Trigger */}
      <button
        onClick={() => setListOpen((v) => !v)}
        className="w-full mt-5 h-9 rounded-lg px-4 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 flex items-center justify-center gap-1.5"
      >
        <Play size={10} className="fill-current" />
        {triggerLabel}
      </button>

      {/* List popout */}
      {listOpen && (
        <div
          ref={listRef}
          className="absolute bottom-full mb-3 right-0 z-[60] flex flex-row-reverse gap-3 items-start"
          style={{ width: "max-content" }}
        >
          {/* ── Curriculum panel (white) ── */}
          <div
            className="flex flex-col rounded-2xl overflow-hidden shadow-xl"
            style={{
              width: 300,
              maxHeight: 420,
              background: "#ffffff",
              border: "1px solid rgba(0,0,0,0.08)",
            }}
          >
            {/* header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
              <div>
                <p className="text-foreground font-semibold text-sm tracking-tight">广告设置</p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  {curriculum.length} 模块 · {totalVideos} 个视频
                </p>
              </div>
              <button
                onClick={() => { lockedRef.current = false; setListOpen(false); setHoveredVideo(null); }}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-secondary"
              >
                <X size={14} />
              </button>
            </div>

            <div className="h-px bg-border mx-4 shrink-0" />

            {/* scrollable list */}
            <div
              className="flex-1 overflow-y-scroll px-2 pb-3 pt-2"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(0,0,0,0.15) transparent",
                overscrollBehavior: "contain",
              }}
            >
              {curriculum.map((part, pi) => (
                <div key={pi} className="mb-3">
                  <div className="flex items-center gap-2 px-2 pb-1">
                    <span className="text-[9px] font-extrabold tracking-widest text-foreground uppercase shrink-0">
                      {part.part}
                    </span>
                    <ChevronRight size={9} className="text-foreground/40 shrink-0" />
                    <span className="text-foreground font-bold text-[11px] truncate">{part.title}</span>
                  </div>

                  <div className="ml-1 space-y-px">
                    {part.videos.map((video, vi) => {
                      const active = hoveredVideo === video.url;
                      return (
                        <button
                          key={vi}
                          onClick={() => setHoveredVideo(video.url)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-left",
                            active ? "bg-primary/8 ring-1 ring-primary/10" : "hover:bg-secondary"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-150",
                            active ? "bg-primary" : "bg-secondary"
                          )}>
                            <Play size={7} className={cn(
                              "fill-current",
                              active ? "text-primary-foreground" : "text-muted-foreground"
                            )} />
                          </div>
                          <span className={cn(
                            "text-[11px] leading-snug line-clamp-2 transition-colors",
                            active ? "text-foreground font-medium" : "text-foreground/70"
                          )}>
                            {video.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Video preview panel (16:9) ── */}
          <div
            className={cn(
              "rounded-2xl overflow-hidden shadow-xl transition-all duration-300",
              hoveredVideo ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
            )}
            style={{
              width: 700,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "#111",
            }}
                      >
            <div
              className="relative group/video cursor-pointer"
              style={{ aspectRatio: "16/9", width: "100%" }}
              onClick={togglePlay}
            >
              {hoveredVideo && (
                <video
                  ref={videoRef}
                  key={hoveredVideo}
                  src={hoveredVideo}
                  muted
                  loop
                  playsInline
                  onTimeUpdate={handleTimeUpdate}
                  className="w-full h-full object-cover"
                />
              )}

              {/* Play/Pause centre indicator */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/video:opacity-100 transition-opacity duration-150 pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                  {isPlaying
                    ? <Pause size={20} className="text-white" />
                    : <Play size={20} className="text-white fill-white" />
                  }
                </div>
              </div>

              {/* Bottom controls bar */}
              <div
                className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-8 flex flex-col gap-2 opacity-0 group-hover/video:opacity-100 transition-opacity duration-150 pointer-events-none group-hover/video:pointer-events-auto"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)" }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Timeline scrubber */}
                <div
                  className="w-full h-1 rounded-full cursor-pointer relative"
                  style={{ background: "rgba(255,255,255,0.25)" }}
                  onClick={handleSeek}
                >
                  <div
                    className="h-full rounded-full bg-white transition-none"
                    style={{ width: `${progress}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow"
                    style={{ left: `calc(${progress}% - 6px)` }}
                  />
                </div>

                {/* Icon row */}
                <div className="flex items-center justify-between">
                  {/* Mute pill button */}
                  <button
                    onClick={toggleMute}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm transition-colors text-white border border-white/20"
                  >
                    {muted
                      ? <VolumeX size={13} className="shrink-0" />
                      : <Volume2 size={13} className="shrink-0" />
                    }
                    {muted && (
                      <span className="text-[11px] font-medium whitespace-nowrap">Tap to Unmute</span>
                    )}
                  </button>

                  {/* Fullscreen */}
                  <button
                    onClick={goFullscreen}
                    className="text-white/80 hover:text-white transition-colors p-1 rounded"
                  >
                    <Maximize size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* label */}
            {hoveredVideo && (
              <div className="px-3 py-2.5">
                <p className="text-white/70 text-[11px] font-medium line-clamp-1 leading-snug">
                  {curriculum
                    .flatMap((p) => p.videos)
                    .find((v) => v.url === hoveredVideo)?.title}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdsSettingsPopout;
