import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";

/**
 * The one video player. Brutalist chrome, self-drawn controls, and the
 * bandwidth gate that both surfaces need.
 *
 * WHY SHARED. Coaching Night and the Course Hub grew from the same prototype and
 * had drifted into two copies of the same controls, one still wearing the
 * pre-rebrand glass look. More importantly they need the same gate — and that
 * gate is the kind of code where missing one condition costs a gigabyte of
 * traffic and reports no error. Two copies of it would drift; one cannot.
 *
 * THE GATE, all of it:
 *   preload="none"        nothing is fetched until something calls play()
 *   dwell 300ms           entering the viewport starts a timer, not playback,
 *                         so scrolling straight past never opens a request
 *   pause on exit         leaving pauses; currentTime is untouched, so coming
 *                         back resumes where it stopped
 *   muted autoplay        the only kind browsers allow, with a centre CTA to
 *                         turn sound on; the mute state then survives scrolling
 *   deliberate pause wins a hand pause is remembered, and the observer will not
 *                         override it on the way back in
 *   refusal falls back    a rejected play() shows the play button rather than
 *                         leaving a frozen black rectangle
 *
 * Differences between the two surfaces are props, never branches on "which
 * screen am I": `autoPlayOnView`, `onEnded`, `placeholder`.
 */
export type VideoPlayerProps = {
  src: string;
  /** Real thumbnail. Without one, `placeholder` covers the black frame. */
  poster?: string;
  /** Shown until playback starts, only when there is no poster. */
  placeholder?: React.ReactNode;
  /** Muted-autoplay once the player has been in view for the dwell time. */
  autoPlayOnView?: boolean;
  /** Bump to play the current src right now — a lesson/episode the viewer just
   *  picked. Changing `src` alone does NOT start playback: switching courses
   *  should land on a paused first lesson, not start streaming. */
  playToken?: number;
  onEnded?: () => void;
  lang: "cn" | "en";
  className?: string;
};

/** Entering the viewport has to persist this long before anything is fetched. */
const DWELL_MS = 300;

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s <= 0) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

const VideoPlayer = ({
  src,
  poster,
  placeholder,
  autoPlayOnView = false,
  playToken = 0,
  onEnded,
  lang,
  className = "",
}: VideoPlayerProps) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const dwellRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  // Autoplay is only permitted muted, so a player that autoplays must start
  // muted. One that does not can start with sound.
  const [muted, setMuted] = useState(autoPlayOnView);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);
  /** A hand pause must survive scrolling out and back, or the observer would
   *  override the one thing the viewer explicitly asked for. */
  const userPausedRef = useRef(false);

  const attemptPlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.play()
      .then(() => {
        startedRef.current = true;
        setStarted(true);
      })
      .catch(() => {
        /* refused (iOS low power, no gesture) — the centre play button is the
           fallback and is already on screen because `playing` stayed false */
      });
  }, []);

  // New src: rewind and clear, keep `muted` (a preference, not per-video state).
  // Deliberately does not play — see `playToken`.
  useEffect(() => {
    const el = videoRef.current;
    userPausedRef.current = false;
    setPlaying(false);
    setProgress(0);
    setDuration(0);
    setStarted(false);
    startedRef.current = false;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  }, [src]);

  // Explicit "play this now", from a viewer picking an episode or a lesson
  // auto-advancing. Skipped on mount so nothing plays unasked.
  const mountedTokenRef = useRef(playToken);
  useEffect(() => {
    if (playToken === mountedTokenRef.current) return;
    mountedTokenRef.current = playToken;
    attemptPlay();
  }, [playToken, attemptPlay]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const clearDwell = () => {
      if (dwellRef.current !== null) {
        window.clearTimeout(dwellRef.current);
        dwellRef.current = null;
      }
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Resume what was already playing, or start it if this surface
          // autoplays. Either way, only after the dwell: a fast scroll past
          // would otherwise open a range request for a file nobody is watching.
          if (userPausedRef.current) return;
          if (!autoPlayOnView && !startedRef.current) return;
          clearDwell();
          dwellRef.current = window.setTimeout(() => {
            dwellRef.current = null;
            attemptPlay();
          }, DWELL_MS);
        } else {
          clearDwell();
          videoRef.current?.pause(); // pause, NOT stop — currentTime survives
        }
      },
      { threshold: 0.35 },
    );
    io.observe(wrap);
    return () => {
      clearDwell();
      io.disconnect();
    };
  }, [autoPlayOnView, attemptPlay]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      userPausedRef.current = false;
      attemptPlay();
    } else {
      userPausedRef.current = true;
      el.pause();
    }
  }, [attemptPlay]);

  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
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

  // Fullscreen the WRAPPER, not the <video>: fullscreening the element hands
  // control back to the browser's native bar, which is the thing these
  // hand-drawn controls exist to avoid (controlsList cannot trim it down).
  const goFullscreen = useCallback(() => {
    wrapRef.current?.requestFullscreen?.();
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`group relative aspect-video w-full overflow-hidden rounded-xl border-2 border-[#141414] bg-[#050505] ${className}`}
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
        onEnded={onEnded}
        onClick={togglePlay}
        className="h-full w-full cursor-pointer object-contain"
      />

      {!poster && !started && placeholder}

      {/* Centre overlay. Paused → play. Playing but muted → the unmute call to
          action, which is the entire point of a muted autoplay. */}
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
        <button type="button" onClick={toggleMute} className="absolute inset-0 flex items-center justify-center">
          <span className="flex items-center gap-2 rounded-xl border-2 border-[#141414] bg-[#fed50a] px-5 py-3 text-sm font-bold text-[#141414] shadow-[4px_4px_0_#141414] transition-transform hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0_#141414]">
            <VolumeX size={18} />
            {lang === "cn" ? "点击开启声音" : "Tap for sound"}
          </span>
        </button>
      ) : null}

      {/* Bottom bar — play/pause, progress, mute, fullscreen. Mute is here as
          well as in the centre so unmuting stays reversible: the centre CTA
          disappears once used, and without this there would be no way back
          short of muting the browser tab. */}
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

export default VideoPlayer;
