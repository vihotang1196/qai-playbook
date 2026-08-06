import { useEffect, useRef, useState } from "react";
import { Video } from "lucide-react";
import VideoPlayer from "@/components/video/VideoPlayer";

/**
 * Coaching Night replay player — now a thin wrapper around the shared
 * <VideoPlayer>. Everything about playback (Brutalist controls, the
 * preload/dwell/pause-on-exit gate, muted autoplay, the unmute CTA) lives there;
 * what is Coaching-specific is only the branded placeholder and the fact that
 * every src change here is a deliberate pick, so it plays immediately.
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
  // Every src change here comes from the viewer clicking a date, so it should
  // play at once. Bumping a token on change (rather than the player treating any
  // src change as "play") keeps the Course Hub free to switch course without
  // starting a stream.
  const [playToken, setPlayToken] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPlayToken((n) => n + 1);
  }, [src]);

  return (
    <VideoPlayer
      src={src}
      poster={poster}
      autoPlayOnView
      playToken={playToken}
      lang={lang}
      placeholder={
        // Most sessions have no cover_url, and with preload="none" there is no
        // frame until buffering starts — without this the first thing on screen
        // is a black rectangle. A cover uploaded in /admin/coaching takes over.
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#050505] px-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#fed50a] text-[#141414]">
            <Video size={26} />
          </span>
          <p className="font-display text-lg font-bold tracking-tight text-white">{label}</p>
          {topic && <p className="text-xs font-semibold tracking-widest text-[#fed50a]">{topic}</p>}
        </div>
      }
    />
  );
};

export default CoachingPlayer;
