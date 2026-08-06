import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, Pause, Play, Video, Volume2, VolumeX } from "lucide-react";

/**
 * Coaching Night replay player.
 *
 * The controls are lifted from the (still unreferenced) OthersVideoGallery
 * prototype — self-drawn progress bar with click-to-seek, mute toggle,
 * fullscreen, controls fading out during playback, big centre overlay. Only the
 * player half was worth taking: that prototype's sidebar groups videos by a
 * PART 1 / PART 2 topic that is computed, not authored, and the new layout
 * wants a horizontal strip instead.
 *
 * WHY preload="none" + IntersectionObserver, not plain autoPlay: every replay
 * is 0.5–1 GB (27 JUL is 963 MB) and the CDN reports `cf-cache-status: BYPASS`,
 * so each view goes back to origin. Autoplaying on page load would have all 918
 * sub-accounts pulling a gigabyte from the homepage. So: nothing loads until the
 * block scrolls into view, and it pauses again the moment it scrolls out —
 * "play when seen" is only half the rule; without the other half the video
 * keeps buffering while the customer reads on down the page.
 *
 * Leaving the viewport PAUSES, never stops: currentTime is untouched, so
 * scrolling back resumes where it left off. The mute state lives in component
 * state and is likewise never reset — someone who unmuted and is actually
 * watching should not be re-muted by a scroll.
 */
type CoachingPlayerProps = {
  src: string;
  /** Real thumbnail when the session has one; otherwise the branded placeholder. */
  poster?: string;
  /** Placeholder copy — the session's display date, e.g. "27 JUL 2026". */
  label: string;
  topic?: string;
  lang: "cn" | "en";
};

const CoachingPlayer = ({ src, poster, label, topic, lang }: CoachingPlayerProps) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  /** Has playback ever started for THIS src — gates the placeholder. */
  const [started, setStarted] = useState(false);
  /** A deliberate pause must survive scrolling out and back; otherwise the
   *  observer would override the one thing the customer explicitly asked for. */
  const userPausedRef = useRef(false);

  // New episode: rewind and clear, but keep `muted` — that is a preference,
  // not per-video state, and re-muting on every switch is infuriating.
  useEffect(() => {
    const el = videoRef.current;
    userPausedRef.current = false;
    setPlaying(false);
    setProgress(0);
    setDuration(0);
    setStarted(false);
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    // The episode was picked by hand, so play it — no need to wait for a scroll.
    el.play().then(() => setStarted(true)).catch(() => {
      /* blocked: the centre play button is already showing */
    });
  }, [src]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const el = videoRef.current;
        if (!el) return;
        if (entry.isIntersecting) {
          if (userPausedRef.current) return;
          el.play().then(() => setStarted(true)).catch(() => {
            /* autoplay refused (iOS low-power, etc.) — the centre play button
               is the fallback, so this must never end up a frozen black box */
          });
        } else {
          el.pause(); // pause, NOT stop: currentTime survives for the way back
        }
      },
      { threshold: 0.35 },
    );
    io.observe(wrap);
    return () => io.disconnect();
  }, []);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      userPausedRef.current = false;
      el.play().then(() => setStarted(true)).catch(() => {});
    } else {
      userPausedRef.current = true;
      el.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const next = !el.muted;
    el.muted = next;
    setMuted(next);
  }, []);

  const onTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (el && el.duration) {
      setProgress(el.currentTime);
      setDuration(el.duration);
    }
  }, []);

  const onSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = videoRef.current;
      const bar = progressRef.current;
      if (!el || !bar || !duration) return;
      const rect = bar.getBoundingClientRect();
      el.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
    },
    [duration],
  );

  // Fullscreen the WRAPPER, not the <video>: fullscreening the element itself
  // hands control back to the browser's native bar, which is the one thing this
  // player exists to avoid (controlsList cannot trim it down to three buttons).
  const goFullscreen = useCallback(() => {
    wrapRef.current?.requestFullscreen?.();
  }, []);

  const fmt = (s: number) => {
    if (!Number.isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  return (
    <div
      ref={wrapRef}
      className="relative aspect-video w-full overflow-hidden rounded-xl border-2 border-[#141414] bg-[#050505] group"
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        muted={muted}
        playsInline
        preload="none"
        controlsList="nodownload"
        disablePictureInPicture
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPlaying={() => setStarted(true)}
        onPause={() => setPlaying(false)}
        onClick={togglePlay}
        className="h-full w-full cursor-pointer object-contain"
      />

      {/* Branded placeholder — only when the session has no real cover. With
          preload="none" there is no frame to show until buffering starts, and
          most sessions have cover_url null, so without this the first thing on
          screen is a black rectangle. Upload a cover in /admin/coaching and it
          takes over automatically. */}
      {!poster && !started && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#050505] px-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#fed50a] text-[#141414]">
            <Video size={26} />
          </span>
          <p className="font-display text-lg font-bold tracking-tight text-white">{label}</p>
          {topic && <p className="text-xs font-semibold tracking-widest text-[#fed50a]">{topic}</p>}
        </div>
      )}

      {/* Centre overlay. Paused → play. Playing but muted → the unmute call to
          action, which is the whole point of a muted autoplay. */}
      {!playing ? (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={lang === "cn" ? "播放" : "Play"}
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#141414] bg-[#fed50a] shadow-[4px_4px_0_#141414] transition-transform hover:scale-105">
            <Play size={34} className="ml-1 fill-[#141414] text-[#141414]" />
          </span>
        </button>
      ) : muted ? (
        <button
          type="button"
          onClick={toggleMute}
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex items-center gap-2 rounded-xl border-2 border-[#141414] bg-[#fed50a] px-5 py-3 text-sm font-bold text-[#141414] shadow-[4px_4px_0_#141414] transition-transform hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0_#141414]">
            <VolumeX size={18} />
            {lang === "cn" ? "点击开启声音" : "Tap for sound"}
          </span>
        </button>
      ) : null}

      {/* Bottom bar — play/pause, progress, mute, fullscreen. The mute button is
          here as well as in the centre so unmuting stays reversible: the centre
          CTA disappears once you use it, and without this there would be no way
          back short of muting the browser tab. */}
      <div
        className={`absolute inset-x-0 bottom-0 transition-opacity duration-200 ${
          playing ? "opacity-0 group-hover:opacity-100 focus-within:opacity-100" : "opacity-100"
        }`}
      >
        <div
          ref={progressRef}
          onClick={onSeek}
          className="h-1.5 w-full cursor-pointer bg-white/25 transition-all hover:h-2.5"
        >
          <div className="h-full bg-[#fed50a]" style={{ width: duration ? `${(progress / duration) * 100}%` : "0%" }} />
        </div>
        <div className="flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? (lang === "cn" ? "暂停" : "Pause") : lang === "cn" ? "播放" : "Play"}
            className="text-white transition-colors hover:text-[#fed50a]"
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <span className="font-mono text-[11px] tabular-nums text-white/80">
            {fmt(progress)} / {fmt(duration)}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? (lang === "cn" ? "开启声音" : "Unmute") : lang === "cn" ? "静音" : "Mute"}
              className="text-white transition-colors hover:text-[#fed50a]"
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button
              type="button"
              onClick={goFullscreen}
              aria-label={lang === "cn" ? "全屏" : "Fullscreen"}
              className="text-white transition-colors hover:text-[#fed50a]"
            >
              <Maximize size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoachingPlayer;
