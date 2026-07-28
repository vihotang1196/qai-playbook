// ════════════════════════════════════════════════════════════════════════
// Display formatting for Offline Event dates and times.
//
// Dates are GENERATED from start_date/end_date here. There is deliberately no
// override field: `display_label` used to double as one, an operator typed the
// event's name into it, and the customer card then rendered that name where the
// date belongs. An optional override is the trap, so it isn't coming back.
// ════════════════════════════════════════════════════════════════════════

type Lang = "cn" | "en";

const CN_WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const EN_MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EN_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Parse "YYYY-MM-DD" as a LOCAL date. `new Date("2026-07-31")` is parsed as UTC
 *  midnight, which lands on the previous day in any negative-offset timezone and
 *  would print the wrong weekday. */
function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "").trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Human date range.
 *   cn cross-day  2026年7月31日 - 8月1日（周五 - 周六）
 *   cn single     2026年7月31日（周五）
 *   en cross-day  31 Jul - 1 Aug 2026 (Fri - Sat)
 *   en single     31 Jul 2026 (Fri)
 * Equal start/end collapses to a single date — never "X - X".
 */
export function formatEventDate(startDate: string, endDate: string, lang: Lang): string {
  const a = parseYmd(startDate);
  const b = parseYmd(endDate) ?? a;
  if (!a || !b) return ""; // caller renders nothing rather than a broken string
  const single = startDate === endDate || a.getTime() === b.getTime();
  const sameYear = a.getFullYear() === b.getFullYear();

  if (lang === "cn") {
    const one = (d: Date, withYear: boolean) =>
      `${withYear ? `${d.getFullYear()}年` : ""}${d.getMonth() + 1}月${d.getDate()}日`;
    if (single) return `${one(a, true)}（${CN_WEEK[a.getDay()]}）`;
    // Year printed once when both ends share it, on each end when they don't.
    return `${one(a, true)} - ${one(b, !sameYear)}（${CN_WEEK[a.getDay()]} - ${CN_WEEK[b.getDay()]}）`;
  }

  const dm = (d: Date) => `${d.getDate()} ${EN_MONTH[d.getMonth()]}`;
  if (single) return `${dm(a)} ${a.getFullYear()} (${EN_WEEK[a.getDay()]})`;
  return sameYear
    ? `${dm(a)} - ${dm(b)} ${b.getFullYear()} (${EN_WEEK[a.getDay()]} - ${EN_WEEK[b.getDay()]})`
    : `${dm(a)} ${a.getFullYear()} - ${dm(b)} ${b.getFullYear()} (${EN_WEEK[a.getDay()]} - ${EN_WEEK[b.getDay()]})`;
}

/**
 * Compact range for dense UI (admin filter dropdowns): "2026-07-31 → 08-01",
 * or just "2026-07-31" for a single day. Lives here, next to the human format,
 * so date rendering stays in ONE module — the long form would overflow a select.
 */
export function formatEventDateCompact(startDate: string, endDate: string): string {
  const a = parseYmd(startDate);
  const b = parseYmd(endDate) ?? a;
  if (!a || !b) return "";
  if (startDate === endDate || a.getTime() === b.getTime()) return startDate.slice(0, 10);
  const mmdd = `${String(b.getMonth() + 1).padStart(2, "0")}-${String(b.getDate()).padStart(2, "0")}`;
  // Year repeated only when the range crosses into another one.
  return a.getFullYear() === b.getFullYear()
    ? `${startDate.slice(0, 10)} → ${mmdd}`
    : `${startDate.slice(0, 10)} → ${endDate.slice(0, 10)}`;
}

/** "10:00:00" → "10:00 AM". Mirrors fmt12h in the offline-event-admin function
 *  so a client-formatted time and a server-generated time_slot never disagree:
 *  hour not zero-padded, minutes two digits, uppercase AM/PM. */
export function fmt12h(t: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t ?? "").trim());
  if (!m) return "";
  let h = Number(m[1]);
  const min = m[2];
  if (!Number.isFinite(h) || h < 0 || h > 23) return "";
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${ap}`;
}

/** Prefer the structured pair; fall back to the stored free text when either end
 *  is missing, so events created before batch 1 still show their time. */
export function formatEventTime(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  timeSlot: string | null | undefined,
): string {
  const a = fmt12h(startTime);
  const b = fmt12h(endTime);
  if (a && b) return `${a} - ${b}`;
  return String(timeSlot ?? "").trim();
}

/** Event name: English when present, Chinese otherwise. Never blank when a
 *  Chinese name exists — an English visitor seeing the Chinese name beats a
 *  ticket with no name on it at all. */
export function eventTitle(
  titleZh: string | null | undefined,
  titleEn: string | null | undefined,
  lang: Lang,
): string {
  const zh = (titleZh ?? "").trim();
  const en = (titleEn ?? "").trim();
  return lang === "en" ? en || zh : zh || en;
}

/** Theme label, or "" when the event has no theme. Falls back en → zh ONLY.
 *  It must never fall back to the event name: that is how the name ended up
 *  displayed as the theme (the same class of bug as name-shown-as-date). */
export function eventTheme(
  themeZh: string | null | undefined,
  themeEn: string | null | undefined,
  lang: Lang,
): string {
  const zh = (themeZh ?? "").trim();
  const en = (themeEn ?? "").trim();
  return lang === "en" ? en || zh : zh || en;
}
