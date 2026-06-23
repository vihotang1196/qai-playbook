import nurtureOs15Jun from "@/assets/nurture-os-15jun.png.asset.json";

export const latestCoachingRecording = {
  date: "27 April 2026",
  url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/69f06ba1eecc3af70ad7006e.mp4",
} as const;

export interface CoachingRecording {
  date: string;
  topic: string;
  url: string;
  /** Optional cover image. When omitted, the UI renders a branded
   *  red-gradient placeholder (icon + date + topic), so a card always
   *  looks complete even without a real thumbnail. */
  cover?: string;
}

// Past Coaching Night replays shown on the homepage. Add new entries here;
// supply `cover` when a thumbnail exists, otherwise the placeholder is used.
export const coachingRecordings: CoachingRecording[] = [
  {
    date: "15 JUN 2026",
    topic: "转化",
    url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/6a30fc59998928ce1fdb43b7.mp4",
    cover: nurtureOs15Jun.url,
  },
];
