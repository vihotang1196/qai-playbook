import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Video, Calendar, Clock, MapPin, CalendarPlus, Rocket, FileText, X } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";
import { coachingRecordings, type CoachingRecording } from "@/lib/coaching";
import GuidedTour from "./GuidedTour";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const COMMUNITY_LINK = "https://chat.whatsapp.com/GrVKU7wl9LuDpYeg3ycTFt";
const ZOOM_LINK = "https://zoom.us/j/6186465988?omn=95854837323";
const WHATSAPP_LINK = "https://wa.me/601112436811";
const VIRTUAL_WALKIN_LINK = "https://meet.goto.com/qaivirtual-walkin";
const COACHING_NIGHT_LINK = "https://meet.goto.com/127055221";

// Get current Malaysia time (UTC+8) as a Date in local TZ representing MYT wall time
const getMytNow = (): Date => {
  const s = new Date().toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" });
  return new Date(s);
};

// Week 1 anchor: Monday June 15, 2026 → 转化
const COACHING_ANCHOR = new Date(2026, 5, 15); // June 15, 2026 (Monday)
const topicForMonday = (monday: Date): string => {
  const diffDays = Math.round((monday.getTime() - COACHING_ANCHOR.getTime()) / 86400000);
  const week = Math.floor(diffDays / 7);
  return week % 2 === 0 ? "转化" : "流量";
};

const getNextMondays = (count: number): Date[] => {
  const myt = getMytNow();
  const today = new Date(myt.getFullYear(), myt.getMonth(), myt.getDate());
  const result: Date[] = [];
  let cursor = new Date(Math.max(today.getTime(), COACHING_ANCHOR.getTime()));
  // Advance to next Monday (include today if Monday)
  const dow = cursor.getDay();
  const addDays = dow === 1 ? 0 : (1 - dow + 7) % 7;
  cursor.setDate(cursor.getDate() + addDays);
  for (let i = 0; i < count; i++) {
    result.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return result;
};

// May 2026 calendar data
const OFFLINE_SIGNUP_LINK = "https://wa.me/601154050265";

// May 1, 2026 is a Friday (Sun=0 ... Fri=5)
const mayInitialEvents: Record<number, { type: "online" | "offline"; time: string }> = {
  // Offline weekends
  9: { type: "offline", time: "10:00AM–6:00PM" },
  10: { type: "offline", time: "10:00AM–6:00PM" },
  23: { type: "offline", time: "10:00AM–6:00PM" },
  24: { type: "offline", time: "10:00AM–6:00PM" },
};

const daysInMay2026 = 31;
const mayStartDay = 5; // May 1, 2026 is Friday (Sun=0)

// Weekday-only grid (Mon–Fri). Sat/Sun hidden because there are no events.
const getDaysArray = () => {
  const days: (number | null)[] = [];
  // May 1, 2026 is Friday → column 4 (Mon=0..Fri=4); pad 4 leading blanks
  for (let i = 0; i < 4; i++) days.push(null);
  for (let d = 1; d <= daysInMay2026; d++) {
    const dow = (mayStartDay + d - 1) % 7; // 0=Sun..6=Sat
    if (dow >= 1 && dow <= 5) days.push(d); // Mon..Fri only
  }
  while (days.length % 5 !== 0) days.push(null);
  return days;
};

const weekdays = {
  cn: ["一", "二", "三", "四", "五"],
  en: ["MON", "TUE", "WED", "THU", "FRI"],
};

const buildGoogleCalendarUrl = (day: number) => {
  const startDate = `202605${String(day).padStart(2, "0")}`;
  const title = encodeURIComponent("Q.AI Coaching Night");
  const details = encodeURIComponent(`Zoom Link: ${ZOOM_LINK}\nZoom ID: 618 646 5988`);
  const location = encodeURIComponent("Zoom");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}T120000Z/${startDate}T140000Z&details=${details}&location=${location}`;
};

// Upcoming topics for right column
const upcomingTopics: {
  date: string; dateEn: string; day: number; time: string;
  startHour: number; endHour: number; type: "online" | "offline" | "walkin";
  title: { cn: string; en: string }; desc: { cn: string; en: string };
  link: string; linkLabel: { cn: string; en: string };
}[] = [
  {
    date: "Virtual Walk-In",
    dateEn: "Virtual Walk-In",
    day: 0,
    time: "3:00–5:00 PM",
    startHour: 15,
    endHour: 17,
    type: "walkin",
    title: { cn: "Virtual Walk-In", en: "Virtual Walk-In" },
    desc: { cn: "星期一至星期五虚拟教室", en: "Mon–Fri virtual classroom" },
    link: VIRTUAL_WALKIN_LINK,
    linkLabel: { cn: "进入教室", en: "Join Room" },
  },
  {
    date: "5月9-10日, 23-24日",
    dateEn: "May 9-10, 23-24",
    day: 9,
    time: "10:00AM–6:00PM",
    startHour: 10,
    endHour: 18,
    type: "offline",
    title: { cn: "线下培训", en: "Offline Training" },
    desc: { cn: "面对面深度培训与实操", en: "In-person deep training & hands-on" },
    link: "https://wa.me/601112436811",
    linkLabel: { cn: "我要复习", en: "Review" },
  },
];

const HeroSection = () => {
  const { lang, hideSubtitles } = useLang();
  const [tourOpen, setTourOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [activeRecording, setActiveRecording] = useState<CoachingRecording | null>(null);
  const [mayEvents, setMayEvents] = useState(mayInitialEvents);
  const [hiddenUpcoming, setHiddenUpcoming] = useState<number[]>([]);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);
  const days = getDaysArray();

  const deleteOfflineEvent = (day: number) => {
    setMayEvents((prev) => {
      const next = { ...prev };
      delete next[day];
      return next;
    });
  };

  // Real-time today (May 2026 context)
  const now = new Date();
  const isMay2026 = now.getMonth() === 4 && now.getFullYear() === 2026;
  const todayDay = isMay2026 ? now.getDate() : 0;

  // Check if today is Mon-Fri 2:50PM-5:00PM MYT for Virtual Walk-In
  const _mytNow = getMytNow();
  const dayOfWeek = _mytNow.getDay(); // 0=Sun
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const _mytMinutes = _mytNow.getHours() * 60 + _mytNow.getMinutes();
  const isWalkInTime = isWeekday && _mytMinutes >= 14 * 60 + 50 && _mytMinutes <= 17 * 60;

  // Public holidays (add future ones here, sorted ascending)
  const holidays: { date: Date; nameCn: string; nameEn: string }[] = [
    { date: new Date(2026, 4, 27), nameCn: "哈芝节 Hari Raya Haji", nameEn: "Hari Raya Haji" },
    { date: new Date(2026, 5, 1), nameCn: "最高元首华诞 Agong's Birthday", nameEn: "Agong's Birthday" },
    { date: new Date(2026, 5, 2), nameCn: "公共假期 Public Holiday", nameEn: "Public Holiday" },
    { date: new Date(2026, 5, 17), nameCn: "回历新年 Awal Muharram", nameEn: "Awal Muharram" },
  ];
  const _today = new Date(); _today.setHours(0, 0, 0, 0);
  const isHolidayToday = holidays.find((h) => {
    const d = new Date(h.date); d.setHours(0, 0, 0, 0);
    return d.getTime() === _today.getTime();
  });
  const upcomingHolidays = (() => {
    const future = holidays.filter((h) => {
      const d = new Date(h.date); d.setHours(0, 0, 0, 0);
      return d.getTime() > _today.getTime();
    });
    if (future.length === 0) return [];
    const group = [future[0]];
    for (let i = 1; i < future.length; i++) {
      const prev = new Date(group[group.length - 1].date); prev.setHours(0, 0, 0, 0);
      const curr = new Date(future[i].date); curr.setHours(0, 0, 0, 0);
      if (curr.getTime() - prev.getTime() === 86400000) group.push(future[i]);
      else break;
    }
    return group;
  })();
  const upcomingHoliday = upcomingHolidays[0];
  const fmtHoliday = (d: Date) =>
    `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })} ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]}`;
  const fmtHolidayRange = () => {
    if (upcomingHolidays.length <= 1) return fmtHoliday(upcomingHoliday.date);
    const first = upcomingHolidays[0].date;
    const last = upcomingHolidays[upcomingHolidays.length - 1].date;
    const month = first.toLocaleString("en-US", { month: "short" });
    return `${first.getDate()} & ${last.getDate()} ${month}`;
  };
  const buttonsDisabled = !!isHolidayToday;

  return (
    <>
    <section id="hero" className="relative flex flex-col items-center overflow-hidden pt-20 md:pt-24 pb-8">
      {/* Hero title — compact */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <h1 className="fade-up font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.12]">
          {t.hero.headline[lang]}
        </h1>
        {!hideSubtitles && (
          <p className="fade-up fade-up-delay-1 mt-4 text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {t.hero.subtitle[lang]}
          </p>
        )}

        {/* Primary CTA + quieter secondary actions */}
        <div className="fade-up fade-up-delay-2 mt-6 flex flex-col items-center gap-4">
          <Button
            size="xl"
            className="px-12"
            onClick={() => window.open("https://qiai.notion.site/qaighlonboarding?v=27528b270a6d813285ac000caaded827&source=copy_link", "_blank")}
          >
            <Rocket size={18} />
            {lang === "cn" ? "系统快速启动" : "Quick Start"}
            <ArrowRight size={18} />
          </Button>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <button
              type="button"
              onClick={() => setTourOpen(true)}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Play size={14} />
              {t.hero.watch[lang]}
            </button>
            <a
              href="https://invoice.qiai.tech/submit"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <FileText size={14} />
              {lang === "cn" ? "申请 Invoice" : "Invoice"}
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </div>

      {/* Two-column: WhatsApp Support + Virtual Walk-In */}
      <div id="hero-cards" className="relative z-10 w-full max-w-5xl mx-auto px-6 mt-6 md:mt-8 mb-4">
        {(isHolidayToday || upcomingHoliday) && (
          <div className="mb-4 flex items-center justify-center gap-2 text-xs md:text-sm font-semibold text-red-600 dark:text-red-400">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {isHolidayToday ? (
              <span>
                {lang === "cn"
                  ? `今日公共假期 · ${isHolidayToday.nameCn} (${fmtHoliday(isHolidayToday.date)}) · 服务暂停`
                  : `Today Public Holiday · ${isHolidayToday.nameEn} (${fmtHoliday(isHolidayToday.date)}) · Service Paused`}
              </span>
            ) : upcomingHoliday ? (
              <span>
                {lang === "cn"
                  ? `即将到来的公共假期 · ${upcomingHoliday.nameCn} (${fmtHolidayRange()})`
                  : `Upcoming Public Holiday · ${upcomingHoliday.nameEn} (${fmtHolidayRange()})`}
              </span>
            ) : null}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Left: WhatsApp Technical Support */}
          <div className="glass-card glass-card-green p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-green-500 text-white">
                  {lang === "cn" ? "技术客服" : "Support"}
                </span>
              </div>
              <h3 className="text-lg font-bold tracking-tight mb-1">
                {lang === "cn" ? "WhatsApp 技术客服" : "WhatsApp Technical Support"}
              </h3>
              <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                <div>{lang === "cn" ? "星期一 - 星期五  10AM – 6PM" : "Mon – Fri  10AM – 6PM"}</div>
                <div>{lang === "cn" ? "星期六  10AM – 1PM" : "Sat  10AM – 1PM"}</div>
              </div>

            </div>
            <Button
              size="sm"
              disabled={buttonsDisabled}
              className="w-full mt-4 bg-gradient-to-r from-[#34D399] to-[#22C55E] hover:brightness-110 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() => !buttonsDisabled && window.open(WHATSAPP_LINK, "_blank")}
            >
              {buttonsDisabled
                ? (lang === "cn" ? "今日公共假期" : "Today Public Holiday")
                : (lang === "cn" ? "联系客服" : "Contact Support")}
            </Button>
          </div>

          {/* Right: Virtual Walk-In */}
          <div className="glass-card glass-card-blue p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gradient-to-r from-[#60A5FA] to-[#3B82F6] text-white">
                  Virtual Walk-In
                </span>
                {isWalkInTime ? (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500 text-white animate-pulse">
                    LIVE
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/15 text-blue-600">
                    {lang === "cn" ? "一至五 3–5PM" : "Mon–Fri 3–5PM"}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold tracking-tight mb-1">
                {lang === "cn" ? "虚拟教室" : "Virtual Classroom"}
              </h3>
              {!hideSubtitles && (
                <p className="text-xs text-muted-foreground">
                  {lang === "cn" ? "星期一至星期五虚拟教室，随时进入" : "Mon–Fri virtual classroom, drop in anytime"}
                </p>
              )}
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Clock size={10} />
                <span>3:00–5:00 PM</span>
              </div>
            </div>
            <Button
              size="sm"
              disabled={buttonsDisabled || !isWalkInTime}
              className="w-full mt-4 bg-gradient-to-r from-[#60A5FA] to-[#3B82F6] hover:brightness-110 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() => !buttonsDisabled && isWalkInTime && window.open(VIRTUAL_WALKIN_LINK, "_blank")}
            >
              {buttonsDisabled ? (
                lang === "cn" ? "今日公共假期" : "Today Public Holiday"
              ) : !isWalkInTime ? (
                lang === "cn" ? "教室未开放" : "Classroom Closed"
              ) : (
                <>
                  <Video size={14} />
                  {lang === "cn" ? "进入教室" : "Join Room"}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ── Coaching Night group: ONE panel — upcoming + past replays ── */}
        <div className="mt-6 md:mt-8">
          <div className="glass-panel-red p-5 md:p-6">
            {/* Header: title + shared session-time note */}
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <h2 className="font-display text-lg md:text-xl font-bold tracking-tight text-foreground">
                  Coaching Night{lang === "cn" && <span className="text-muted-foreground font-medium"> · 教练之夜</span>}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                8:00PM – 9:30PM · {lang === "cn"
                  ? "7:00PM 起可进入等候室，8:00PM 正式开始"
                  : "Waiting room opens 7:00PM, starts 8:00PM"}
              </p>
            </div>

            {/* Two zones: upcoming sessions | past replays */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 md:divide-x divide-red-500/15">
              {/* Left — upcoming sessions */}
              <div className="md:pr-8">
                <p className="text-[11px] font-semibold tracking-widest uppercase text-red-600/80 mb-3">
                  {lang === "cn" ? "即将到来" : "Upcoming"}
                </p>
                {(() => {
                  const myt = getMytNow();
                  const nextMondays = getNextMondays(3);
                  const fmtMd = (d: Date) => `${d.getMonth() + 1}月 ${d.getDate()}日`;
                  const fmtMdEn = (d: Date) =>
                    `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}`;
                  const minutes = myt.getHours() * 60 + myt.getMinutes();
                  const isSameDay = (a: Date, b: Date) =>
                    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
                  // All sessions share one room link, so a single Join button
                  // gated on "is any date live now" (today + 19:00–21:30 MYT).
                  const liveIndex = nextMondays.findIndex(
                    (d) => isSameDay(d, myt) && minutes >= 19 * 60 && minutes <= 21 * 60 + 30,
                  );
                  const anyLive = liveIndex >= 0;
                  return (
                    <>
                      <div className="space-y-2">
                        {nextMondays.map((d, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 rounded-xl bg-red-500/[0.05] px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-bold tracking-tight text-foreground truncate">
                                {lang === "cn" ? `${fmtMd(d)} · 一` : `${fmtMdEn(d)} · Mon`}
                              </span>
                              {i === liveIndex && (
                                <span className="shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-500 text-white animate-pulse">
                                  LIVE
                                </span>
                              )}
                            </div>
                            <span className="shrink-0 px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 text-[11px] font-semibold">
                              {topicForMonday(d)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        variant={anyLive ? "default" : "outline"}
                        disabled={!anyLive}
                        className={`mt-4 w-full ${anyLive ? "bg-gradient-to-r from-[#F87171] to-[#EF4444] hover:brightness-110 text-white shadow-lg shadow-red-500/25" : "border-border text-muted-foreground/70"}`}
                        onClick={() => anyLive && window.open(COACHING_NIGHT_LINK, "_blank")}
                      >
                        <Video size={14} />
                        {lang === "cn" ? "📹 进入教室" : "📹 Join Room"}
                      </Button>
                    </>
                  );
                })()}
              </div>

              {/* Right — past replays */}
              <div>
                <p className="text-[11px] font-semibold tracking-widest uppercase text-red-600/80 mb-3">
                  {lang === "cn" ? "过往录像" : "Past Replays"}
                </p>
                {coachingRecordings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {lang === "cn" ? "暂无录像，敬请期待。" : "No recordings yet. Stay tuned."}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {coachingRecordings.map((r, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveRecording(r)}
                        className="group flex w-full items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5 text-left transition-all duration-300 hover:bg-red-500/[0.10]"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-600 transition-colors group-hover:bg-red-500 group-hover:text-white">
                          <Play size={14} className="fill-current ml-0.5" />
                        </span>
                        <span className="flex flex-1 items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground">{r.date}</span>
                          <span className="text-[11px] font-medium text-red-600">{r.topic}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <GuidedTour isOpen={tourOpen} onClose={() => setTourOpen(false)} />

    </section>


      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden" style={{ maxHeight: "90vh" }}>
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{lang === "cn" ? "申请 Invoice" : "Request Invoice"}</DialogTitle>
          </DialogHeader>
          <div className="w-full overflow-y-auto" style={{ height: "1115px", maxHeight: "calc(90vh - 60px)" }}>
            <iframe
              src="https://api.qiai.tech/widget/form/zp4gSkpcmPKeY3jIxp2L"
              className="w-full border-none rounded-b-lg"
              style={{ width: "100%", height: "1115px", border: "none", borderRadius: "3px" }}
              id="inline-zp4gSkpcmPKeY3jIxp2L"
              data-layout="{'id':'INLINE'}"
              data-trigger-type="alwaysShow"
              data-activation-type="alwaysActivated"
              data-deactivation-type="neverDeactivate"
              data-form-name="Request Invoice"
              data-height="1115"
              data-layout-iframe-id="inline-zp4gSkpcmPKeY3jIxp2L"
              data-form-id="zp4gSkpcmPKeY3jIxp2L"
              title="Request Invoice"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Coaching Night replay player */}
      <Dialog open={!!activeRecording} onOpenChange={(open) => !open && setActiveRecording(null)}>
        <DialogContent className="max-w-3xl w-[92vw] p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 text-left">
            <DialogTitle className="text-base font-semibold tracking-tight">
              {lang === "cn" ? "Coaching Night 回放" : "Coaching Night Replay"}
              {activeRecording && <span className="text-muted-foreground font-medium"> — {activeRecording.date} · {activeRecording.topic}</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-5 md:px-5">
            {activeRecording && (
              <video
                key={activeRecording.url}
                src={activeRecording.url}
                poster={activeRecording.cover}
                controls
                autoPlay
                playsInline
                className="w-full aspect-video rounded-xl bg-black"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default HeroSection;
