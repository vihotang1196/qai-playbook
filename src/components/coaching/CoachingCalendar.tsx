import { useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import type { CoachingRecording } from "@/lib/coaching";

/**
 * Coaching Night month calendar.
 *
 * Highlights EVERY Monday — that is the schedule, and it has nothing to do with
 * whether a replay was uploaded. A Monday with no replay is a real session whose
 * recording is still missing (the 流量 weeks have historically not been
 * uploaded), not a week without a class.
 *
 * Three day states, on two independent visual channels so they can stack:
 *   fill+border  — solid yellow / solid ink border = session WITH a replay (clickable)
 *                  faint yellow / DASHED ink border = session, no replay (inert)
 *   outer ring   — today
 * The dashed-means-unavailable convention is borrowed from SeatMap's 已满 seats
 * rather than invented here, and the ring is a separate channel precisely
 * because today can itself be either kind of Monday.
 *
 * The hover hint distinguishes a third case the styling deliberately does not:
 * a FUTURE Monday has no replay because it has not happened yet. Telling a
 * customer 「暂无回放」 about next week's class reads as a broken page.
 */
type Props = {
  /** ISO `YYYY-MM-DD` → recording, for the sessions that have one. */
  replays: Map<string, CoachingRecording>;
  /** ISO of the episode currently in the player, so the calendar can mark it. */
  activeIso: string | null;
  onPick: (rec: CoachingRecording) => void;
  /** Today in Malaysia time — passed in, never re-derived from the browser. */
  today: Date;
  /** First-ever session; Mondays before it were not on this schedule. */
  anchor: Date;
  /** Next upcoming session, for the line underneath. */
  next: Date | null;
  /** The schedule's topic for a given Monday (转化 / 流量 alternating). Owned by
   *  HeroSection — the algorithm stays there, this component only renders it. */
  topicFor: (d: Date) => string;
  lang: "cn" | "en";
};

/** Local-date ISO. NOT toISOString(), which converts to UTC and hands back the
 *  previous day for anyone east of Greenwich. */
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const CN_WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const CoachingCalendar = ({ replays, activeIso, onPick, today, anchor, next, topicFor, lang }: Props) => {
  /** Every Monday of the displayed month that is on or after the anchor. */
  const mondays = useMemo(() => {
    const out: Date[] = [];
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    d.setDate(d.getDate() + ((1 - d.getDay() + 7) % 7)); // first Monday
    while (d.getMonth() === today.getMonth()) {
      if (d.getTime() >= anchor.getTime()) out.push(new Date(d));
      d.setDate(d.getDate() + 7);
    }
    return out;
  }, [today, anchor]);

  const withReplay = mondays.filter((d) => replays.has(toIso(d)));
  const pending = mondays.filter((d) => !replays.has(toIso(d)));
  const active = activeIso ? mondays.filter((d) => toIso(d) === activeIso) : [];

  const hint = (d: Date): string | undefined => {
    const rec = replays.get(toIso(d));
    if (rec) return undefined; // clickable; no hint needed
    if (!mondays.some((m) => sameDay(m, d))) return undefined;
    // A session that has not happened yet has no replay for a good reason.
    if (d.getTime() > today.getTime()) {
      const t = topicFor(d);
      return lang === "cn" ? `即将开课${t ? ` · ${t}` : ""}` : `Upcoming${t ? ` · ${t}` : ""}`;
    }
    return lang === "cn" ? "暂无回放" : "No replay yet";
  };

  return (
    <div>
      <Calendar
        mode="default"
        month={today}
        weekStartsOn={1}
        disableNavigation
        showOutsideDays={false}
        onDayClick={(day) => {
          const rec = replays.get(toIso(day));
          if (rec) onPick(rec);
        }}
        modifiers={{ replay: withReplay, pending, activeDay: active }}
        modifiersClassNames={{
          replay:
            "bg-[#fed50a] text-[#141414] font-bold border-2 border-[#141414] cursor-pointer hover:brightness-105",
          // Faint fill + dashed border = "there was a class, you just can't watch it".
          pending: "bg-[#fed50a]/30 text-[#141414] border-2 border-dashed border-[#141414] cursor-default",
          activeDay: "shadow-[3px_3px_0_#141414]",
        }}
        formatters={{
          formatCaption: (m) =>
            lang === "cn"
              ? `${m.getFullYear()} 年 ${m.getMonth() + 1} 月`
              : m.toLocaleString("en-US", { month: "long", year: "numeric" }),
          formatWeekdayName: (d) =>
            lang === "cn" ? CN_WEEKDAYS[d.getDay()] : d.toLocaleString("en-US", { weekday: "narrow" }),
        }}
        components={{
          DayContent: ({ date }) => (
            <span title={hint(date)} className="flex h-full w-full items-center justify-center">
              {date.getDate()}
            </span>
          ),
        }}
        className="p-0"
        classNames={{
          // The month wrapper is a flex item in the stock `months` row, so it
          // shrank to content (99px) and every width below it inherited that.
          // Everything else here is downstream of these two.
          months: "flex w-full",
          month: "w-full space-y-2",
          caption: "flex justify-start pt-0 pb-2 relative items-center",
          caption_label: "font-display text-base font-bold tracking-tight text-foreground",
          // Fluid grid, not the stock fixed w-9 cells: at 36px the month only
          // filled about half the column and left a band of white beside the
          // full-width Join button under it, which read as a misalignment.
          // flex-1 + aspect-square keeps the seven columns equal and the cells
          // square at any column width, so nothing stretches out of shape.
          // The <table> is forced to block layout. react-day-picker renders a
          // real table, and table layout fights `flex-1` on the cells: the tracks
          // size from content instead of the row, which collapsed every day to
          // 14px. Dropping table layout makes the flex rows behave normally.
          table: "block w-full",
          head: "block w-full",
          tbody: "block w-full",
          head_row: "flex w-full",
          head_cell: "flex-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground",
          row: "flex w-full mt-1",
          cell: "flex-1 aspect-square p-0 text-center relative",
          // absolute inset-0, not h-full/w-full: the cell's height comes from
          // aspect-ratio, and a percentage height against that does not resolve
          // — the button collapsed to its text and sat 21px inside a 48px cell.
          // cursor-default by default — react-day-picker's own button class sets
          // pointer on every day, which promises a click that only the days with
          // a replay actually honour. The `replay` modifier puts it back.
          day: "absolute inset-0 p-0 font-normal text-base rounded-lg cursor-default transition-[filter,box-shadow] duration-150",
          // Ring, not a fill: today can itself be either kind of Monday, so the
          // "you are here" marker has to survive on top of both.
          day_today: "ring-2 ring-[#141414] ring-offset-2 ring-offset-white",
          day_outside: "invisible",
        }}
      />

      {/* Only the current month is shown, so at month's end the next session is
          off-screen entirely. This line is the only thing covering that gap. */}
      {next && (
        <p className="mt-3 text-xs text-muted-foreground">
          {lang === "cn"
            ? `下一场：${next.getMonth() + 1}月${next.getDate()}日 · ${topicFor(next)}`
            : `Next session: ${next.toLocaleString("en-US", { month: "short", day: "numeric" })} · ${topicFor(next)}`}
        </p>
      )}
    </div>
  );
};

export default CoachingCalendar;
