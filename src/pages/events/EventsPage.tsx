import { useEffect, useState } from "react";
import {
  CalendarDays,
  Clock,
  Ticket,
  Loader2,
  AlertCircle,
  Check,
  Copy,
  ChevronDown,
} from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { resolveLocationId } from "@/lib/ghl";
import { SeatMap } from "@/components/offline-event/SeatMap";
import {
  resolveContext,
  listEvents,
  getEvent,
  layoutToSeatGroups,
  type OeContext,
  type OeEvent,
  type OeSeatGroup,
} from "@/lib/offlineEvent";

/**
 * Offline Event — CUSTOMER booking page (`/events`).
 *
 * Identity = GHL location_id (trust-the-URL; resolved URL→tab-session via
 * resolveLocationId, same as Helpdesk). No location_id → "open from QAI" gate.
 * Tool off (Admin Portal) → a friendly disabled notice. P3 is READ-ONLY: browse
 * events + view the seat map + see the free-ticket balance. Booking = P4/P5.
 * All data comes through the location-scoped `oe` edge fn (never the tables).
 */
export default function EventsPage() {
  const { lang } = useLang();
  const [locationId] = useState<string>(() => resolveLocationId());
  const [ctx, setCtx] = useState<OeContext | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    resolveContext(locationId)
      .then((c) => {
        if (cancelled) return;
        setCtx(c);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  if (!locationId) return <OpenFromQai lang={lang} />;

  if (loading) {
    return (
      <Shell>
        <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      </Shell>
    );
  }

  if (err || !ctx) {
    return (
      <Shell>
        <div className="glass-card rounded-2xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">{lang === "cn" ? "加载失败" : "Failed to load"}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{err ?? (lang === "cn" ? "无数据" : "No data")}</p>
          </div>
        </div>
      </Shell>
    );
  }

  if (!ctx.enabled) return <ToolDisabled lang={lang} />;

  return <BookingBrowser lang={lang} locationId={locationId} ctx={ctx} />;
}

/** Page shell: inside Layout (navbar + footer), clears the fixed navbar. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen px-4 sm:px-6 pb-16 pt-24 md:pt-28">
      <div className="max-w-4xl mx-auto">{children}</div>
    </div>
  );
}

// ── Browse events + seat map (read-only, P3) ──────────────────────────────
function BookingBrowser({ lang, locationId, ctx }: { lang: "cn" | "en"; locationId: string; ctx: OeContext }) {
  const [events, setEvents] = useState<OeEvent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listEvents(locationId)
      .then((e) => !cancelled && setEvents(e))
      .catch((x) => !cancelled && setErr(x instanceof Error ? x.message : "加载失败"));
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const freeRemaining = ctx.freeSeatsRemaining ?? 0;

  return (
    <Shell>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}>
          <CalendarDays className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-display font-bold leading-tight">
            {lang === "cn" ? "线下活动报名" : "Offline Event Booking"}
          </h1>
          <p className="text-sm text-muted-foreground truncate">
            {ctx.businessName || (lang === "cn" ? "选择活动 · 挑座位 · 报名" : "Pick an event · choose seats · book")}
          </p>
        </div>
      </div>

      {/* Free-ticket balance */}
      <div className="glass-card rounded-2xl px-4 py-3 mb-5 flex items-center gap-2.5">
        <Ticket className="w-4 h-4 text-primary shrink-0" />
        <p className="text-sm">
          {lang === "cn" ? (
            freeRemaining > 0 ? (
              <>你还有 <span className="font-bold text-primary">{freeRemaining}</span> 张免费票（最多 4 人/单）</>
            ) : (
              <>你的免费票已用完，超出部分按活动票价收费（最多 4 人/单）</>
            )
          ) : freeRemaining > 0 ? (
            <>You have <span className="font-bold text-primary">{freeRemaining}</span> free ticket{freeRemaining === 1 ? "" : "s"} (up to 4 / booking)</>
          ) : (
            <>Your free tickets are used up; extra seats are charged at the event price (up to 4 / booking)</>
          )}
        </p>
      </div>

      {/* Events */}
      {err ? (
        <div className="glass-card rounded-2xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">{err}</p>
        </div>
      ) : !events ? (
        <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">
          {lang === "cn" ? "暂时没有可报名的活动。" : "No events open for booking right now."}
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <EventCard
              key={ev.id}
              lang={lang}
              locationId={locationId}
              event={ev}
              open={openId === ev.id}
              onToggle={() => setOpenId((id) => (id === ev.id ? null : ev.id))}
            />
          ))}
        </div>
      )}

      <p className="mt-5 text-xs text-muted-foreground">
        {lang === "cn"
          ? "现在是浏览模式（选座与付款报名将在下一步开放）。座位图实时来自会场布局，前端不直连数据表。"
          : "Browse mode for now (seat selection + paid booking arrive next). The seat map is live from the venue layout; the frontend never touches the tables."}
      </p>
    </Shell>
  );
}

function EventCard({
  lang,
  locationId,
  event,
  open,
  onToggle,
}: {
  lang: "cn" | "en";
  locationId: string;
  event: OeEvent;
  open: boolean;
  onToggle: () => void;
}) {
  const theme = (lang === "cn" ? event.theme_zh : event.theme_en) || event.display_label;
  const notice = lang === "cn" ? event.notice_zh : event.notice_en;
  const displayOnly = event.status === "display";

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full text-left px-5 py-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold truncate">{theme}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{event.display_label}</span>
            {event.time_slot && <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{event.time_slot}</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold tabular-nums">RM {Number(event.price_per_seat).toFixed(0)}</p>
          <p className="text-[11px] text-muted-foreground">
            {event.seats_left != null
              ? lang === "cn" ? `剩 ${event.seats_left} 座` : `${event.seats_left} left`
              : lang === "cn" ? "座位充足" : "seats open"}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-3 sm:px-5 pb-5 pt-1">
          {displayOnly && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-sm font-medium text-amber-900 text-center">
              {lang === "cn" ? "此场次已截止报名（仅供查看）" : "Registration closed (view only)"}
            </div>
          )}
          {notice && <p className="mb-3 text-sm text-muted-foreground">{notice}</p>}
          {event.seat_selection_enabled === false ? (
            <div className="glass-card rounded-2xl p-6 text-center text-sm text-muted-foreground">
              {lang === "cn" ? "本场不需选座，报名时填写出席人数即可。" : "No seat selection for this event — just enter attendee count when booking."}
            </div>
          ) : (
            <EventSeatMap lang={lang} locationId={locationId} eventId={event.id} />
          )}
        </div>
      )}
    </div>
  );
}

/** Loads + renders one event's seat map (read-only). */
function EventSeatMap({ lang, locationId, eventId }: { lang: "cn" | "en"; locationId: string; eventId: string }) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; msg: string }
    | { kind: "ready"; groups: OeSeatGroup[]; columns: number; rows: number; showDoor: boolean }
    | { kind: "noplan" }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    getEvent(locationId, eventId)
      .then(({ floorPlan, bookedSeats }) => {
        if (cancelled) return;
        if (!floorPlan) {
          setState({ kind: "noplan" });
          return;
        }
        const { groups, layout } = layoutToSeatGroups(floorPlan.layout_data, bookedSeats);
        setState({
          kind: "ready",
          groups,
          columns: layout.columns,
          rows: layout.rows,
          showDoor: layout.door !== "none",
        });
      })
      .catch((e) => !cancelled && setState({ kind: "error", msg: e instanceof Error ? e.message : "加载失败" }));
    return () => {
      cancelled = true;
    };
  }, [locationId, eventId]);

  if (state.kind === "loading") {
    return (
      <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="glass-card rounded-2xl p-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">{state.msg}</p>
      </div>
    );
  }
  if (state.kind === "noplan") {
    return (
      <div className="glass-card rounded-2xl p-6 text-center text-sm text-muted-foreground">
        {lang === "cn" ? "本场暂未设置座位图。" : "No seat map configured for this event yet."}
      </div>
    );
  }

  return (
    <SeatMap
      seatGroups={state.groups}
      selectedSeatIds={[]}
      selectedGroupId={null}
      onToggleSeat={() => {}}
      warning={null}
      columns={state.columns}
      rows={state.rows}
      showDoor={state.showDoor}
      readOnly
    />
  );
}

// ── Gates ─────────────────────────────────────────────────────────────────
const QAI_URL = "https://app.qiai.tech/";

/** No identity (not opened from QAI). Customers know the QAI brand, not GHL. */
function OpenFromQai({ lang }: { lang: "cn" | "en" }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    const fallback = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = QAI_URL;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        done();
      } catch {
        /* leave the link for manual copy */
      }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(QAI_URL).then(done, fallback);
    } else {
      fallback();
    }
  }
  return (
    <div className="min-h-screen px-4 sm:px-6 pb-16 pt-24 md:pt-28">
      <div className="max-w-md mx-auto">
        <div className="glass-card rounded-3xl p-8 sm:p-10 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-white" style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}>
            <CalendarDays className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-display font-bold mb-2">{lang === "cn" ? "线下活动报名" : "Offline Event Booking"}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lang === "cn"
              ? "请从你的 QAI 后台打开活动报名，这样才能识别你的账号。"
              : "Please open event booking from your QAI dashboard so we can recognise your account."}
          </p>
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 p-1.5 pl-3">
            <a href={QAI_URL} target="_blank" rel="noreferrer" className="text-sm font-mono truncate flex-1 text-left text-primary hover:underline">
              {QAI_URL}
            </a>
            <button type="button" onClick={copy} className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 shrink-0 hover:opacity-90 transition-opacity">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? (lang === "cn" ? "已复制" : "Copied") : (lang === "cn" ? "复制" : "Copy")}
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {lang === "cn"
              ? "打开上面的网址登录 QAI，再从里面进入活动报名。"
              : "Open the link above, sign in to QAI, then enter event booking from there."}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Tool switched off for this Sub Account in the Admin Portal. */
function ToolDisabled({ lang }: { lang: "cn" | "en" }) {
  return (
    <div className="min-h-screen px-4 sm:px-6 pb-16 pt-24 md:pt-28">
      <div className="max-w-md mx-auto">
        <div className="glass-card rounded-3xl p-8 sm:p-10 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-white" style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}>
            <CalendarDays className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-display font-bold mb-2">{lang === "cn" ? "活动报名" : "Event Booking"}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lang === "cn"
              ? "活动报名暂未对你的账号开放。如需开通，请联系 QAI 管理员。"
              : "Event booking isn't enabled for your account yet. Please contact your QAI admin to enable it."}
          </p>
        </div>
      </div>
    </div>
  );
}
