import { getSupabase } from "@/lib/supabase";
import nurtureOs15Jun from "@/assets/nurture-os-15jun.png.asset.json";

export interface CoachingRecording {
  date: string;
  topic: string;
  url: string;
  /** Optional cover image. When omitted, the UI renders a branded
   *  red-gradient placeholder (icon + date + topic), so a card always
   *  looks complete even without a real thumbnail. */
  cover?: string;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** `2026-07-27` → `27 JUL 2026`, the exact shape the homepage has always shown.
 *  Parsed off the string rather than via `new Date(iso)`: that parses a bare
 *  YYYY-MM-DD as UTC midnight, so any viewer west of Greenwich would see the
 *  previous day. A DATE column has no timezone — treat it as plain text. */
export function formatCoachingDate(iso: string): string {
  const [y, m, d] = String(iso).split("-");
  const month = MONTHS[Number(m) - 1];
  if (!y || !month || !d) return String(iso);
  return `${d} ${month} ${y}`;
}

// 这是 2026-08-05 的快照，仅在 coaching 函数不可用时兜底。
// 它会随时间腐烂 —— 如果看到首页录像数量比后台少，
// 说明函数挂了正在走这里。
// 不要试图让它自动同步（会引入缓存一致性问题）。
const FALLBACK_RECORDINGS: CoachingRecording[] = [
  {
    date: "27 JUL 2026",
    topic: "转化",
    url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/6a67600495687dbf221e49dd.mp4",
    // no cover → branded placeholder fallback
  },
  {
    date: "13 JUL 2026",
    topic: "转化",
    url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/6a55de071097b811959d71f8.mp4",
    // no cover → branded placeholder fallback
  },
  {
    date: "29 JUN 2026",
    topic: "转化",
    url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/6a4340e63a7f0c5468a4a952.mp4",
    // no cover → branded placeholder fallback
  },
  {
    date: "15 JUN 2026",
    topic: "转化",
    url: "https://assets.cdn.filesafe.space/UQhNDa03bFrytsA8NXtD/media/6a30fc59998928ce1fdb43b7.mp4",
    cover: nurtureOs15Jun.url,
  },
];

type ReplayRow = {
  id: string;
  session_date: string;
  topic: string | null;
  replay_url: string;
  cover_url: string | null;
};

/**
 * Past Coaching Night replays, newest first, from the `coaching` edge fn
 * (coaching_sessions is RLS-locked — the frontend never reads it directly).
 *
 * Three outcomes, kept distinct on purpose:
 *   fn unreachable / errored → FALLBACK_RECORDINGS + a console.warn, so the
 *     homepage still looks right for customers while F12 tells the owner the
 *     function is down. No toast: a broken back end is not the visitor's problem.
 *   fn returns zero rows     → `[]`, so the caller shows the real empty state.
 *     NOT the fallback: an intentionally empty list must be allowed to be empty.
 *   fn returns rows          → those rows.
 */
export async function fetchCoachingReplays(): Promise<CoachingRecording[]> {
  try {
    const { data, error } = await getSupabase().functions.invoke<{ replays: ReplayRow[] }>("coaching", {
      body: { action: "listReplays" },
    });
    if (error) throw error;
    // A success without the contracted key is a broken deploy, not an empty list.
    if (!data || !Array.isArray(data.replays)) throw new Error("malformed response");
    return data.replays.map((r) => ({
      date: formatCoachingDate(r.session_date),
      topic: r.topic ?? "",
      url: r.replay_url,
      cover: r.cover_url ?? undefined,
    }));
  } catch (e) {
    console.warn("coaching fn unavailable, using fallback", e);
    return FALLBACK_RECORDINGS;
  }
}
