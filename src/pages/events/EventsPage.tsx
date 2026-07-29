import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Clock,
  Ticket,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Check,
  Copy,
  ChevronDown,
  Minus,
  Plus,
  ArrowLeft,
  Utensils,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageContext";
import { resolveLocationId, inIframe } from "@/lib/ghl";
import { formatEventDate, formatEventTime, eventTitle, eventTheme, formatSstPct } from "@/lib/offlineEventFormat";
import { SeatMap } from "@/components/offline-event/SeatMap";
import { QrTicket } from "@/components/offline-event/QrTicket";
import { MyBookings } from "@/components/offline-event/MyBookings";
import {
  resolveContext,
  listEvents,
  getEvent,
  createBooking,
  createCheckout,
  getBooking,
  layoutToSeatGroups,
  type OeContext,
  type OeEvent,
  type OeSeatGroup,
  type OeSeat,
  type OeBooking,
  type OeFloorPlanLayout,
} from "@/lib/offlineEvent";

/**
 * Offline Event — CUSTOMER booking page (`/events`).
 *
 * Identity = GHL location_id (trust-the-URL; resolveLocationId, same as Helpdesk).
 * No location_id → "open from QAI" gate. Tool off → disabled notice. P4: seat
 * selection + FREE booking (atomic seat claim server-side). Paid bookings show a
 * "payment coming (P5)" notice. All data goes through the location-scoped `oe`
 * edge fn (never the tables); pricing + free-ticket accounting are server-side.
 */
export default function EventsPage() {
  const { lang } = useLang();
  // Read once from the URL — cheap, and needed before any data call (see below).
  const [embeddedCancel] = useState<boolean>(() => {
    const q = new URLSearchParams(window.location.search);
    return q.get("embed") === "1" && q.get("checkout") === "cancelled";
  });
  const [locationId] = useState<string>(() => resolveLocationId());
  const [ctx, setCtx] = useState<OeContext | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCtx = useCallback(() => {
    // The effect below is declared before the embeddedCancel early-return, so it
    // still fires on that render — bail out HERE too, or the "no requests at
    // all" promise would be broken by a stray resolveContext call.
    if (embeddedCancel || !locationId) {
      setLoading(false);
      return;
    }
    resolveContext(locationId)
      .then((c) => {
        setCtx(c);
        setLoading(false);
      })
      .catch((e) => {
        setErr(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      });
  }, [locationId, embeddedCancel]);

  useEffect(() => {
    loadCtx();
  }, [loadCtx]);

  // ── Cancelled checkout in a spawned tab ──────────────────────────────────
  // FIRST, before the locationId gate and before loadCtx fires: this tab exists
  // only because Stripe bounced the customer back, and it needs no data at all,
  // so nothing is requested. Showing the full event list here would invite them
  // to rebook in the throwaway tab and forget the GHL iframe they started in.
  // Only with embed=1 — a normal cancel (e.g. a WhatsApp link on a phone) still
  // gets the ordinary event list, unchanged.
  if (embeddedCancel) return <EmbeddedCancelled lang={lang} />;

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
          <AlertCircle className="w-5 h-5 text-[#141414] shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">{lang === "cn" ? "加载失败" : "Failed to load"}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{err ?? (lang === "cn" ? "无数据" : "No data")}</p>
          </div>
        </div>
      </Shell>
    );
  }

  if (!ctx.enabled) return <ToolDisabled lang={lang} />;

  return <BookingBrowser lang={lang} locationId={locationId} ctx={ctx} onRefreshCtx={loadCtx} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    // Natural height (no min-h-screen) — the content sizes to itself and the
    // footer follows it, instead of forcing a full viewport that pushes the
    // footer a screen below a short event list. Centered column (max-w-4xl).
    <div className="px-4 sm:px-6 pb-16 pt-24 md:pt-28">
      <div className="max-w-4xl mx-auto">{children}</div>
    </div>
  );
}

// ── Browse events + book ──────────────────────────────────────────────────
function BookingBrowser({ lang, locationId, ctx, onRefreshCtx }: { lang: "cn" | "en"; locationId: string; ctx: OeContext; onRefreshCtx: () => void }) {
  const [events, setEvents] = useState<OeEvent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showMine, setShowMine] = useState(false);

  const loadEvents = useCallback(() => {
    listEvents(locationId)
      .then(setEvents)
      .catch((x) => setErr(x instanceof Error ? x.message : "加载失败"));
  }, [locationId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // After a booking: refresh the free balance + seats-left counts.
  const handleBooked = useCallback(() => {
    onRefreshCtx();
    loadEvents();
  }, [onRefreshCtx, loadEvents]);

  const freeRemaining = ctx.freeSeatsRemaining ?? 0;

  return (
    <Shell>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-[#fed50a] shrink-0" style={{ background: "#141414" }}>
          <CalendarDays className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-display font-bold leading-tight">{lang === "cn" ? "线下活动报名" : "Offline Event Booking"}</h1>
          <p className="text-sm text-muted-foreground truncate">{ctx.businessName || (lang === "cn" ? "选择活动 · 挑座位 · 报名" : "Pick an event · choose seats · book")}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowMine(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full border-2 border-[#141414] bg-white px-3 py-2 text-xs font-bold hover:bg-muted/50"
        >
          <Ticket className="w-3.5 h-3.5 text-[#141414]" />
          {lang === "cn" ? "我的报名" : "My bookings"}
        </button>
      </div>

      {showMine && <MyBookings lang={lang} locationId={locationId} onClose={() => setShowMine(false)} />}

      <div className="glass-card rounded-2xl px-4 py-3 mb-5 flex items-center gap-2.5">
        <Ticket className="w-4 h-4 text-[#141414] shrink-0" />
        <p className="text-sm">
          {lang === "cn" ? (
            freeRemaining > 0 ? (
              <>你还有 <span className="font-bold text-[#141414] bg-[#fed50a] px-1.5 rounded">{freeRemaining}</span> 张免费票（最多 4 人/单）</>
            ) : (
              <>你的免费票已用完，超出部分按活动票价收费（最多 4 人/单）</>
            )
          ) : freeRemaining > 0 ? (
            <>You have <span className="font-bold text-[#141414] bg-[#fed50a] px-1.5 rounded">{freeRemaining}</span> free ticket{freeRemaining === 1 ? "" : "s"} (up to 4 / booking)</>
          ) : (
            <>Your free tickets are used up; extra seats are charged at the event price (up to 4 / booking)</>
          )}
        </p>
      </div>

      {err ? (
        <div className="glass-card rounded-2xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#141414] shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">{err}</p>
        </div>
      ) : !events ? (
        <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">{lang === "cn" ? "暂时没有可报名的活动。" : "No events open for booking right now."}</div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <EventCard
              key={ev.id}
              lang={lang}
              locationId={locationId}
              ctx={ctx}
              event={ev}
              open={openId === ev.id}
              onToggle={() => setOpenId((id) => (id === ev.id ? null : ev.id))}
              onBooked={handleBooked}
            />
          ))}
        </div>
      )}

      <p className="mt-5 text-xs text-muted-foreground">
        {lang === "cn"
          ? "选座、价格与免费票额度都由后端核算（前端不直连数据表）。收费订单通过 Stripe 安全付款。"
          : "Seats, pricing and free-ticket allowance are computed server-side (the frontend never touches the tables). Paid orders are charged securely via Stripe."}
      </p>
    </Shell>
  );
}

function EventCard({
  lang,
  locationId,
  ctx,
  event,
  open,
  onToggle,
  onBooked,
}: {
  lang: "cn" | "en";
  locationId: string;
  ctx: OeContext;
  event: OeEvent;
  open: boolean;
  onToggle: () => void;
  onBooked: () => void;
}) {
  const title = eventTitle(event.title_zh, event.title_en, lang);
  // en → zh ONLY. It must never fall back to the event's name: doing that is how
  // the name came to be displayed as the theme, the same bug as name-as-date.
  const theme = eventTheme(event.theme_zh, event.theme_en, lang);
  // Notice falls back to Chinese rather than vanishing — a silently missing
  // notice means the customer saw nothing and we have no "was told" record.
  const noticeFellBack = lang === "en" && !((event.notice_en ?? "").trim()) && !!(event.notice_zh ?? "").trim();
  const notice = (lang === "cn" ? event.notice_zh : (event.notice_en || event.notice_zh)) || "";
  // Dates are GENERATED; display_label plays no part in rendering any more.
  const dateText = formatEventDate(event.start_date, event.end_date, lang);
  const timeText = formatEventTime(event.start_time, event.end_time, event.time_slot);
  const displayOnly = event.status === "display";
  // The headline price EXCLUDES SST, so say so on the card instead of letting
  // the customer meet the extra 8% for the first time at checkout. No rate
  // configured → no claim about tax (never guess a rate the server didn't send).
  const cardSstRate = ctx.settings?.sstRate;
  const showSstHint = !!cardSstRate && cardSstRate > 0 && Number(event.price_per_seat) > 0;

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Roomier, with a clear type hierarchy: NAME largest, then the real date,
          then time + theme as a small tag. Kept to ~4 compact lines so at least
          three cards still fit on one screen. Price/seats-left keep their spot. */}
      <button type="button" onClick={onToggle} className="w-full text-left px-5 sm:px-6 py-5 sm:py-6 flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-lg sm:text-xl leading-snug truncate">{title}</p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm sm:text-base font-semibold text-[#141414]">
            <CalendarDays className="w-4 h-4 shrink-0" />
            {dateText}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5 text-xs text-muted-foreground">
            {timeText && <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{timeText}</span>}
            {/* No theme → the tag isn't rendered at all. */}
            {theme && (
              <span className="inline-flex items-center rounded-full bg-[#fed50a] text-[#141414] border-2 border-[#141414] px-2 py-0.5 text-[11px] font-bold">
                {theme}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base sm:text-lg font-bold tabular-nums">RM {Number(event.price_per_seat).toFixed(0)}</p>
          {showSstHint && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {lang === "cn" ? `另加 ${formatSstPct(cardSstRate!)}% SST` : `+${formatSstPct(cardSstRate!)}% SST`}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {event.seats_left != null ? (lang === "cn" ? `剩 ${event.seats_left} 座` : `${event.seats_left} left`) : lang === "cn" ? "座位充足" : "seats open"}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-3 sm:px-5 pb-5 pt-1">
          {displayOnly ? (
            <div className="mb-3 rounded-xl border-2 border-[#141414] bg-white px-4 py-2.5 text-sm font-medium text-[#141414] text-center">
              {lang === "cn" ? "此场次已截止报名（仅供查看）" : "Registration closed (view only)"}
            </div>
          ) : null}
          {notice && (
            <div className="mb-3">
              {/* Says the language switched, so an English reader knows this is a
                  fallback and not a broken page. */}
              {noticeFellBack && (
                <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">Notice shown in Chinese</p>
              )}
              <p className="text-sm text-muted-foreground">{notice}</p>
            </div>
          )}
          <EventBooking lang={lang} locationId={locationId} ctx={ctx} event={event} readOnly={displayOnly} onBooked={onBooked} onExit={onToggle} />
        </div>
      )}
    </div>
  );
}

// ── Per-event booking flow (seat select → email → confirm → QR) ────────────
type SelSeat = { id: string; label: string };

function EventBooking({
  lang,
  locationId,
  ctx,
  event,
  readOnly,
  onBooked,
  onExit,
}: {
  lang: "cn" | "en";
  locationId: string;
  ctx: OeContext;
  event: OeEvent;
  readOnly: boolean;
  onBooked: () => void;
  onExit?: () => void;
}) {
  const seatSelection = event.seat_selection_enabled !== false;
  const [mapState, setMapState] = useState<
    | { kind: "loading" }
    | { kind: "error"; msg: string }
    | { kind: "noplan" }
    | { kind: "ready"; groups: OeSeatGroup[]; layout: OeFloorPlanLayout }
  >({ kind: "loading" });
  const [selected, setSelected] = useState<SelSeat[]>([]);
  const [qty, setQty] = useState(1); // for seat-selection-disabled events
  const [lunchQty, setLunchQty] = useState(0);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Guards doBooking against double submission in the same tick (see doBooking).
  const inFlight = useRef(false);
  const [done, setDone] = useState<OeBooking | null>(null);

  // Stepped flow (matches the old app): selecting → addons → summary, all on the
  // same page (no route change), scrolling to the active step on each change.
  const [phase, setPhase] = useState<"selecting" | "addons" | "summary">("selecting");
  const [lunchChoice, setLunchChoice] = useState<"yes" | "no" | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [mismatchOpen, setMismatchOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const firstPhase = useRef(true);

  const maxSeats = ctx.settings?.maxSeats ?? 4;
  const lunchPrice = ctx.settings?.lunchPrice ?? 39.99;
  const sstRate = ctx.settings?.sstRate ?? 0.08;
  const freeRemaining = ctx.freeSeatsRemaining ?? 0;
  const seatsLeft = event.seats_left ?? Number.POSITIVE_INFINITY;
  const cap = Math.max(0, Math.min(maxSeats, seatsLeft));

  const loadMap = useCallback(() => {
    if (!seatSelection) {
      setMapState({ kind: "noplan" });
      return;
    }
    setMapState({ kind: "loading" });
    getEvent(locationId, event.id)
      .then(({ floorPlan, bookedSeats }) => {
        if (!floorPlan) {
          setMapState({ kind: "noplan" });
          return;
        }
        const { groups, layout } = layoutToSeatGroups(floorPlan.layout_data, bookedSeats);
        setMapState({ kind: "ready", groups, layout });
      })
      .catch((e) => setMapState({ kind: "error", msg: e instanceof Error ? e.message : "加载失败" }));
  }, [locationId, event.id, seatSelection]);

  useEffect(() => {
    loadMap();
  }, [loadMap]);

  const toggleSeat = useCallback(
    (seat: OeSeat, groupId: string) => {
      const label = `${groupId} Seat ${seat.seatNumber}`;
      setSelected((prev) => {
        const exists = prev.find((s) => s.id === seat.id);
        if (exists) return prev.filter((s) => s.id !== seat.id);
        if (prev.length >= cap) {
          toast.error(lang === "cn" ? `最多可选 ${cap} 个座位` : `Up to ${cap} seats`);
          return prev;
        }
        return [...prev, { id: seat.id, label }];
      });
    },
    [cap, lang],
  );

  const seatCount = seatSelection ? selected.length : qty;
  const freeUsed = Math.min(seatCount, freeRemaining);
  const paidSeats = Math.max(0, seatCount - freeUsed);
  const subtotal = Math.round((paidSeats * Number(event.price_per_seat) + lunchQty * lunchPrice) * 100) / 100;
  const sst = subtotal > 0 ? Math.round(subtotal * sstRate * 100) / 100 : 0;
  const total = Math.round((subtotal + sst) * 100) / 100;

  // Lunch can never exceed the seat count (seats may shrink if the user goes back
  // and deselects). Keep it clamped.
  useEffect(() => {
    setLunchQty((q) => Math.min(q, Math.max(0, seatCount)));
  }, [seatCount]);

  // The floating confirm bar's real height, so the seat map can reserve exactly
  // that much room below itself. MEASURED, not hardcoded: the bar grows a second
  // row while free tickets remain and its text wraps on narrow screens, so any
  // constant is wrong in some state — and when it is too small the bar sits on
  // top of the last row of seats. Declared after seatCount on purpose (it is a
  // dependency).
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);
  // No dependency array on purpose: this runs after EVERY render, which covers
  // every content-driven height change (the pill appearing, seat labels growing,
  // a language switch). The window listener covers the other cause — a viewport
  // change that rewraps the text without any re-render. The state guard makes
  // the unconditional effect safe: identical height → no setState → no loop.
  //
  // A ResizeObserver would be the tidier tool and was tried first; it is also
  // driven by the rendering pipeline, which made it impossible to verify in a
  // non-compositing browser pane. This version needs neither.
  useLayoutEffect(() => {
    const measure = () => {
      const h = barRef.current?.offsetHeight ?? 0;
      setBarHeight((prev) => (prev === h ? prev : h));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });


  // Smooth-scroll to the active step on each step change (skip first mount).
  useEffect(() => {
    if (firstPhase.current) {
      firstPhase.current = false;
      return;
    }
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [phase]);

  // The fixed confirm bar shows only once a seat is chosen (step 1). While it's
  // up, reserve its height at the very bottom of the page so it never overlaps
  // the shared footer when the user scrolls all the way down. Reset when the bar
  // hides (seats cleared / step change / booked) or this card unmounts.
  // The fixed bar renders in every context again (see the render below), so its
  // height must be reserved again in every context too.
  const barActive = phase === "selecting" && seatCount > 0 && !done;
  useEffect(() => {
    if (!barActive) return;
    const prev = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "132px";
    return () => {
      document.body.style.paddingBottom = prev;
    };
  }, [barActive]);

  // ── Paid-in-a-new-tab state (iframe only) ────────────────────────────────
  // Checkout runs in another tab, so this one must not sit frozen on "正在打开
  // 付款页". Poll the booking until the server (which verifies with Stripe)
  // reports confirmed, then show success here too — a customer who switches
  // back to GHL should see that the order went through.
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [payBlocked, setPayBlocked] = useState(false);
  const [payCode, setPayCode] = useState<string | null>(null);
  // Straight from the createCheckout response, so the waiting screen quotes the
  // window the sweep will actually apply to THIS booking.
  const [payHoldMinutes, setPayHoldMinutes] = useState<number | null>(null);

  // "Pay within N minutes." N is the server's HOLD_STALE_MINUTES — from the
  // checkout response once we have one (that is the window this very booking
  // gets), otherwise from resolveContext. NEVER a literal: the sweep enforces the
  // number, so the sentence has to follow it. If the server didn't send one we
  // render nothing at all — silence beats a stale promise about someone's seats.
  // Declared HERE, after payHoldMinutes: reading a `const` declared further down
  // is a temporal-dead-zone crash at render, and tsc does not catch it.
  const holdMinutes = payHoldMinutes ?? ctx.settings?.holdMinutes ?? null;
  const holdNotice = holdMinutes
    ? lang === "cn"
      ? `请在 ${holdMinutes} 分钟内完成付款，超时座位将被释放`
      : `Please complete payment within ${holdMinutes} minutes or your seats will be released`
    : null;

  // The ONE way a confirmed paid booking reaches the UI. Polling and the
  // broadcast accelerator both call this — there is no second render path.
  const applyConfirmed = useCallback(
    (b: OeBooking) => {
      setDone(b);
      setPayUrl(null);
      setPayBlocked(false);
      onBooked();
    },
    [onBooked],
  );

  useEffect(() => {
    if (!payCode || !payUrl || done) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await getBooking(locationId, payCode);
        if (!active) return;
        if (r.status === "confirmed" && r.booking) {
          applyConfirmed(r.booking);
          return; // stop polling
        }
        if (r.status === "cancelled") {
          setPayUrl(null);
          setPayBlocked(false);
          toast.error(lang === "cn" ? "这笔付款已取消或超时，请重新选座" : "That payment was cancelled or expired — please pick seats again");
          setPhase("selecting");
          loadMap();
          return;
        }
      } catch {
        /* transient — keep polling */
      }
      if (active) timer = setTimeout(tick, 4000);
    };
    timer = setTimeout(tick, 4000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payCode, payUrl, done, locationId]);

  // ── Broadcast accelerator (PARALLEL to the polling above, never a
  // replacement) ───────────────────────────────────────────────────────────
  // The payment tab announces success, which just makes the switch feel instant
  // instead of up-to-4-seconds late. The polling loop remains the proven path
  // and is untouched; if this listener never fires, nothing is lost.
  //
  // The message is treated as a NUDGE and nothing more: its payload is never
  // rendered. We re-ask the server (getBooking), which is the only authority on
  // whether money actually arrived, and only a confirmed answer reaches the UI.
  useEffect(() => {
    if (!payCode || done) return;
    let active = true;
    let ch: BroadcastChannel | null = null;

    const onNudge = async (data: unknown) => {
      const d = data as { type?: string; bookingCode?: string } | null;
      if (!d || d.type !== "checkout_success") return;
      // Must be THIS booking — otherwise a second tab paying for a different
      // order could flip this one's UI.
      if (d.bookingCode !== payCode) return;
      try {
        const r = await getBooking(locationId, payCode);
        if (!active) return;
        if (r.status === "confirmed" && r.booking) applyConfirmed(r.booking);
      } catch {
        /* ignore — the polling loop will get there */
      }
    };

    const onMessage = (e: MessageEvent) => {
      // Same-origin only. Anything else is not ours, no matter what it claims.
      if (e.origin !== window.location.origin) return;
      void onNudge(e.data);
    };

    try {
      if (typeof BroadcastChannel !== "undefined") {
        ch = new BroadcastChannel("qai-checkout");
        ch.onmessage = (e) => void onNudge(e.data);
      }
    } catch {
      /* unsupported → polling only */
    }
    window.addEventListener("message", onMessage);

    return () => {
      active = false;
      window.removeEventListener("message", onMessage);
      try {
        ch?.close();
      } catch {
        /* already closed */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payCode, done, locationId, applyConfirmed]);

  const emailValid = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

  // The actual booking call. Server decides free vs paid (authoritative);
  // free → confirmed here, paid → Stripe hosted checkout redirect. Untouched
  // from the pre-step flow except that a seat clash sends the user back to step 1.
  async function doBooking() {
    if (seatCount < 1) return;
    // SYNCHRONOUS lock. `disabled={submitting}` is not enough on its own: the
    // state update is async, so a fast double-click fires onClick twice before
    // React re-renders the disabled button — which would create two pending
    // bookings and two Stripe sessions, holding seats twice. A ref flips in the
    // same tick, so the second click can never get in. Deliberately not a
    // debounce: a delay does not stop a slow double-click, only a lock does.
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      const input = {
        event_id: event.id,
        email: email.trim(),
        seats: seatSelection ? selected.map((s) => s.label) : undefined,
        quantity: seatSelection ? undefined : qty,
        lunch_qty: lunchQty,
      };
      const res = await createBooking(locationId, input);
      if ("ok" in res && res.ok) {
        setDone(res.booking);
        onBooked();
      } else if ("requiresPayment" in res) {
        // ── Paid path. Stripe Checkout sends X-Frame-Options: DENY, so inside
        // the GHL iframe it CANNOT render — navigating the iframe to it just
        // shows a blank frame. Framed → open a new tab; standalone → keep the
        // full-page redirect, which is the nicer experience.
        const framed = inIframe();

        // The window MUST be opened synchronously in the click's gesture, before
        // any await — otherwise the gesture is spent and the popup is blocked.
        const win = framed ? window.open("", "_blank") : null;
        if (framed && win) {
          win.document.write(
            `<!doctype html><meta charset="utf-8"><title>${lang === "cn" ? "正在前往付款…" : "Opening payment…"}</title>` +
              `<body style="font:16px system-ui;padding:2rem">${lang === "cn" ? "正在前往 Stripe 付款页…" : "Opening the Stripe payment page…"}</body>`,
          );
        }

        toast.message(lang === "cn" ? "正在打开付款页…" : "Opening payment…");
        const { checkoutUrl, bookingCode, holdMinutes: holdFromCheckout } = await createCheckout(locationId, {
          ...input,
          origin: window.location.origin,
          // Tells the return/cancel pages they are a spawned tab (framed flow).
          embed: framed,
        });
        setPayCode(bookingCode);
        if (holdFromCheckout) setPayHoldMinutes(holdFromCheckout);

        if (!framed) {
          window.location.href = checkoutUrl;
          return; // page navigates away
        }
        if (win) {
          win.location.replace(checkoutUrl);
          setPayUrl(checkoutUrl); // → "waiting for payment" state + polling
        } else {
          // Popup blocked. Show a real link the customer clicks themselves — a
          // direct click always opens, and never lose the URL either way.
          setPayUrl(checkoutUrl);
          setPayBlocked(true);
        }
        return;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "报名失败";
      if (msg === "seats_unavailable") {
        toast.error(lang === "cn" ? "所选座位刚被订走，请重新选择" : "Those seats were just taken — please pick again");
        setSelected([]);
        setPhase("selecting");
        loadMap();
        onBooked();
      } else if (msg === "too_many_seats") {
        toast.error(lang === "cn" ? `最多 ${maxSeats} 个座位` : `Max ${maxSeats} seats`);
      } else if (msg === "rate_limited") {
        // Say plainly that nothing happened — a throttled customer must not be
        // left wondering whether they were charged or lost their seats.
        toast.error(
          lang === "cn"
            ? "操作太频繁，请等一分钟再试。这次没有扣款，也没有占用座位。"
            : "Too many attempts — please wait a minute and try again. You have NOT been charged and no seats were held.",
          { duration: 8000 },
        );
      } else {
        toast.error(msg);
      }
    } finally {
      // Always released, on every path — success, seat clash, rate limit, popup
      // blocked, thrown error. A lock that can stick would leave the customer
      // permanently unable to book.
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  // Final gate before booking/payment (matches the old app): the email must be
  // valid AND the no-refund policy must be acknowledged — either failing blocks
  // submission, shows the error inline, and nothing is sent (never reaches Stripe).
  const handleSubmit = () => {
    let ok = true;
    if (!emailValid(email)) {
      setEmailError(lang === "cn" ? "请填写有效邮箱" : "Please enter a valid email");
      ok = false;
    } else {
      setEmailError(null);
    }
    if (!acknowledged) {
      setPolicyError(lang === "cn" ? "请勾选同意不退款政策" : "Please agree to the no-refund policy");
      ok = false;
    } else {
      setPolicyError(null);
    }
    if (seatCount < 1) {
      toast.error(lang === "cn" ? "请先选座" : "Please select a seat");
      ok = false;
    }
    if (!ok) return;
    doBooking();
  };

  // ── Step transitions (selecting → addons → summary) ──
  const goToAddons = () => {
    if (seatCount < 1) {
      toast.error(lang === "cn" ? "请先选座" : "Please select a seat");
      return;
    }
    setPhase("addons");
  };
  const chooseLunch = (choice: "yes" | "no") => {
    setLunchChoice(choice);
    if (choice === "no") {
      setLunchQty(0);
      setPhase("summary");
    } else {
      setLunchQty((q) => (q > 0 ? q : Math.max(1, seatCount)));
    }
  };
  const confirmAddons = () => {
    if (lunchQty !== seatCount) {
      setMismatchOpen(true);
      return;
    }
    setPhase("summary");
  };

  // Return from the success ticket to the event list: clear this event's form
  // state, then collapse the card (onExit) so the customer sees the full list.
  const handleBack = () => {
    setDone(null);
    setSelected([]);
    setLunchQty(0);
    setEmail("");
    setPhase("selecting");
    setLunchChoice(null);
    setAcknowledged(false);
    onExit?.();
  };

  // ── Success (free booking confirmed) ──
  if (done) return <QrTicket lang={lang} booking={done} paid={false} onBack={handleBack} />;

  // Seat area — interactive seat map, or an attendee stepper when seat selection
  // is off. Reused read-only for display/closed events. (SeatMap itself is
  // untouched; we only change the flow around it.)
  const seatArea = (interactive: boolean) =>
    !seatSelection ? (
      <div className="glass-card rounded-2xl p-5">
        <p className="text-sm font-medium mb-2">{lang === "cn" ? "出席人数" : "Attendees"}</p>
        <Stepper value={qty} min={1} max={cap} onChange={setQty} disabled={!interactive} />
      </div>
    ) : mapState.kind === "loading" ? (
      <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
    ) : mapState.kind === "error" ? (
      <div className="glass-card rounded-2xl p-6 flex items-start gap-3"><AlertCircle className="w-5 h-5 text-[#141414] shrink-0 mt-0.5" /><p className="text-sm text-muted-foreground">{mapState.msg}</p></div>
    ) : mapState.kind === "noplan" ? (
      <div className="glass-card rounded-2xl p-6 text-center text-sm text-muted-foreground">{lang === "cn" ? "本场暂未设置座位图。" : "No seat map configured yet."}</div>
    ) : (
      <SeatMap
        seatGroups={mapState.groups}
        selectedSeatIds={interactive ? selected.map((s) => s.id) : []}
        selectedGroupId={null}
        onToggleSeat={toggleSeat}
        warning={null}
        maxSelectable={cap}
        columns={mapState.layout.columns}
        rows={mapState.layout.rows}
        door={mapState.layout.door}
        doorPos={mapState.layout.doorPos}
        stage={mapState.layout.stage}
        stagePosition={mapState.layout.stagePosition}
        divider={mapState.layout.divider}
        readOnly={!interactive}
      />
    );

  // ── Display-only / closed events: read-only map, no booking flow, no bar ──
  if (readOnly) {
    return <div ref={rootRef} className="space-y-3">{seatArea(false)}</div>;
  }

  const splitText =
    freeUsed > 0 || paidSeats > 0
      ? `${lang === "cn" ? "免费" : "free"} ${freeUsed}${paidSeats > 0 ? ` · ${lang === "cn" ? "付费" : "paid"} ${paidSeats}` : ""}`
      : "";

  // The confirm bar's contents, shared by both placements (fixed / inline) so
  // the two can never drift apart.
  const barInner = (
    <>
      {freeRemaining > 0 && (
        <div className="mb-2 flex justify-center">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fed50a] text-[#141414] text-xs font-bold px-3 py-1 shadow border-2 border-[#141414]">
            <Ticket className="w-3.5 h-3.5" />
            {lang === "cn" ? `剩余 ${freeRemaining} 张免费门票` : `${freeRemaining} free ticket${freeRemaining === 1 ? "" : "s"} left`}
          </span>
        </div>
      )}
      <div className="rounded-2xl shadow-xl border-2 border-[#141414] bg-white px-4 py-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">
            {seatSelection
              ? lang === "cn" ? `已选 ${seatCount} 个座位` : `${seatCount} seat${seatCount === 1 ? "" : "s"} selected`
              : lang === "cn" ? `${seatCount} 位出席` : `${seatCount} attendee${seatCount === 1 ? "" : "s"}`}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {seatSelection && selected.length > 0 ? `${selected.map((s) => s.label).join("、")}${splitText ? " · " : ""}` : ""}
            {splitText}
          </p>
        </div>
        <p className="text-sm font-bold tabular-nums shrink-0">{total > 0 ? `RM ${total.toFixed(2)}` : lang === "cn" ? "免费" : "Free"}</p>
        <button
          type="button"
          onClick={goToAddons}
          disabled={seatCount < 1}
          className="shrink-0 h-10 px-4 rounded-full bg-primary text-primary-foreground border-2 border-[#141414] text-sm font-bold disabled:opacity-40"
        >
          {lang === "cn" ? `确认 — ${seatCount} 张票` : `Confirm — ${seatCount}`}
        </button>
      </div>
    </>
  );

  // Paying in another tab (framed only). Never a dead end: the URL is always
  // offered as a real link, which is also the recovery path when the popup was
  // blocked outright.
  if (payUrl && !done) {
    return (
      <div ref={rootRef} className="glass-card rounded-2xl p-5 space-y-3 text-center">
        {!payBlocked && <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#141414]" />}
        <p className="font-bold">
          {payBlocked
            ? lang === "cn" ? "浏览器拦住了付款窗口" : "Your browser blocked the payment window"
            : lang === "cn" ? "付款页已在新窗口打开" : "Payment opened in a new window"}
        </p>
        <p className="text-sm text-muted-foreground">
          {payBlocked
            ? lang === "cn" ? "请点下面的按钮打开付款页。" : "Tap the button below to open it."
            : lang === "cn" ? "请在新窗口完成付款。付好之后这里会自动显示成功，电子票会在那个窗口打开。" : "Finish paying in that window. This page updates automatically, and the ticket opens there."}
        </p>
        {/* THE screen the customer actually waits on, so the deadline belongs
            here most of all — and it covers the blocked-popup branch too, which
            is where someone is most likely to wander off and come back late.
            This used to read "held for ~30 minutes" as a literal; it was wrong
            the moment the window became 10. Rendered only when the server told
            us the number: no value → no claim. */}
        {holdNotice && (
          <p className="text-xs font-bold text-[#141414] bg-[#fed50a] border-2 border-[#141414] rounded-full px-3 py-1 inline-block">
            {holdNotice}
          </p>
        )}
        <a
          href={payUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center h-11 px-5 rounded-full bg-primary text-primary-foreground border-2 border-[#141414] text-sm font-bold"
        >
          {payBlocked ? (lang === "cn" ? "打开付款页" : "Open payment page") : (lang === "cn" ? "重新打开付款页" : "Reopen payment page")}
        </a>
        <button
          type="button"
          onClick={() => { setPayUrl(null); setPayBlocked(false); setPayCode(null); setPhase("selecting"); loadMap(); onBooked(); }}
          className="block mx-auto text-xs text-muted-foreground hover:text-foreground underline"
        >
          {lang === "cn" ? "放弃这次付款，重新选座" : "Give up and pick seats again"}
        </button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="space-y-4">
      {/* ── Step 1: select seats (+ fixed bottom confirm bar) ── */}
      {phase === "selecting" && (
        <>
          {/* Padding is MEASURED from the bar, not guessed. The bar is 1 or 2 rows
              depending on whether the free-ticket pill shows, and its text wraps
              on narrow screens — a fixed pb-32 was under the real height in the
              two-row case, so the bar sat on top of the last row of seats. */}
          <div style={{ paddingBottom: seatCount > 0 ? barHeight + 24 : 0 }}>{seatArea(true)}</div>

          {/* Floating bar, portalled to <body>. SETTLED BY OBSERVATION in the
              real GHL frame: this one IS visible there, so the iframe scrolls
              internally and `fixed` correctly pins to the iframe's own viewport.
              An inline bar was tried and removed — it landed below the tall
              91-seat map, out of view. Portalled because the event card is
              overflow-hidden and would clip a fixed child.

              The bottom gap is env(safe-area-inset-bottom) + 1.25rem: pb-4 alone
              left the bar flush against the viewport edge, where a phone's home
              indicator / browser chrome ate the bottom half of it and the confirm
              button could not be tapped. */}
          {seatCount > 0 && createPortal(
            <div
              ref={barRef}
              className="fixed bottom-0 left-0 right-0 z-40 px-3 sm:px-4 pointer-events-none"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
            >
              <div className="max-w-4xl mx-auto pointer-events-auto">{barInner}</div>
            </div>,
            document.body,
          )}
        </>
      )}

      {/* ── Step 2: lunch add-on ── */}
      {phase === "addons" && (
        <div className="space-y-3">
          <button type="button" onClick={() => setPhase("selecting")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> {lang === "cn" ? "上一步 · 改座位" : "Back · edit seats"}
          </button>
          <div className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-start gap-2">
              <Utensils className="w-5 h-5 text-[#141414] mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{lang === "cn" ? "需要加购午餐吗？" : "Would you like to add lunch?"}</p>
                <p className="text-xs text-muted-foreground">RM {lunchPrice.toFixed(2)} / {lang === "cn" ? "份（含两天午餐）" : "set (both days' lunch)"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border-2 border-[#141414] bg-white text-[#141414] px-3 py-2 text-sm font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {lang === "cn" ? "注意：午餐不适合素食者。" : "Note: Lunch is not suitable for vegetarians."}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => chooseLunch("no")} className={`h-11 rounded-xl border-2 text-sm font-medium transition-colors ${lunchChoice === "no" ? "border-[#141414] bg-[#fed50a] text-[#141414]" : "border-[#141414]/25 hover:bg-muted/40"}`}>
                {lang === "cn" ? "不用了" : "No thanks"}
              </button>
              <button type="button" onClick={() => chooseLunch("yes")} className={`h-11 rounded-xl border-2 text-sm font-medium transition-colors ${lunchChoice === "yes" ? "border-[#141414] bg-[#fed50a] text-[#141414]" : "border-[#141414]/25 hover:bg-muted/40"}`}>
                {lang === "cn" ? "要加购" : "Add lunch"}
              </button>
            </div>
            {lunchChoice === "yes" && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{lang === "cn" ? "午餐份数" : "Lunch sets"}</p>
                  <Stepper value={lunchQty} min={1} max={Math.max(1, seatCount)} onChange={setLunchQty} />
                </div>
                <button type="button" onClick={confirmAddons} className="btn-gradient w-full h-11 rounded-full text-sm font-bold">
                  {lang === "cn" ? `确认加购 × ${lunchQty}` : `Confirm × ${lunchQty}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 3: order summary (email + mandatory no-refund gate) ── */}
      {phase === "summary" && (
        <div className="space-y-3">
          <button type="button" onClick={() => setPhase("addons")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> {lang === "cn" ? "上一步 · 改午餐" : "Back · edit lunch"}
          </button>
          <div className="glass-card rounded-2xl p-5 space-y-3">
            <p className="font-display font-bold">{lang === "cn" ? "订单摘要" : "Order summary"}</p>
            {seatSelection && (
              <p className="text-sm">
                {lang === "cn" ? "座位" : "Seats"}: <span className="font-medium">{selected.map((s) => s.label).join("、") || "—"}</span>
              </p>
            )}
            <div className="text-sm space-y-1">
              <Row l={lang === "cn" ? "座位" : "Seats"} r={`${seatCount}${freeUsed > 0 ? `（${lang === "cn" ? "免费" : "free"} ${freeUsed}${paidSeats > 0 ? ` · ${lang === "cn" ? "付费" : "paid"} ${paidSeats}` : ""}）` : ""}`} />
              {/* Money per line, mirroring the Stripe checkout summary — the page
                  and the Stripe page must not itemise differently. */}
              {paidSeats > 0 && (
                <Row
                  l={lang === "cn" ? "付费门票" : "Paid tickets"}
                  r={`${paidSeats} × RM ${Number(event.price_per_seat).toFixed(2)}`}
                />
              )}
              {lunchQty > 0 && <Row l={lang === "cn" ? "午餐" : "Lunch"} r={`${lunchQty} × RM ${lunchPrice.toFixed(2)}`} />}
              {total > 0 && <Row l={`SST ${formatSstPct(sstRate)}%`} r={`RM ${sst.toFixed(2)}`} />}
              <Row l={lang === "cn" ? "合计" : "Total"} r={total > 0 ? `RM ${total.toFixed(2)}` : lang === "cn" ? "免费" : "Free"} bold />
            </div>
            <div>
              <label className="text-sm font-medium">{lang === "cn" ? "邮箱" : "Email"}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(null); }}
                placeholder="you@example.com"
                className={`mt-1 w-full rounded-xl border-2 bg-white px-3 py-2 text-sm outline-none focus:border-[#141414] focus:shadow-[0_0_0_3px_rgba(254,213,10,0.5)] ${emailError ? "border-[#141414]" : "border-[#141414]/30"}`}
              />
              <p className="text-xs text-muted-foreground mt-1">{lang === "cn" ? "报名成功后二维码门票会显示在下一页，请截图保存。" : "Your QR ticket shows on the next page — screenshot it."}</p>
              {emailError && <p className="text-xs text-[#141414] font-semibold mt-1">{emailError}</p>}
            </div>
            <div className="rounded-xl border-2 border-[#141414] bg-[#141414] p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#fed50a] shrink-0 mt-0.5" />
                <p className="text-sm text-white font-medium">
                  {lang === "cn" ? "付款一旦完成，恕不退款。请在继续前仔细确认您的订单。" : "Once payment is made, no refund will be issued. Please review your order carefully before proceeding."}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => { setAcknowledged(e.target.checked); if (policyError) setPolicyError(null); }}
                  className="w-4 h-4 rounded border-border accent-[#fed50a]"
                />
                {lang === "cn" ? "我已知悉不退款政策" : "I acknowledge the no-refund policy"}
              </label>
              {policyError && <p className="text-xs text-[#fed50a] font-semibold">{policyError}</p>}
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="btn-gradient w-full h-11 rounded-full text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {total > 0
                ? lang === "cn" ? `去付款 RM ${total.toFixed(2)}` : `Pay RM ${total.toFixed(2)}`
                : lang === "cn" ? "确认免费报名" : "Confirm free booking"}
            </button>
            {/* Only on the paid path — a free booking is confirmed on the spot and
                nothing is ever released. Plain small text, deliberately below the
                button: it is a condition of paying, not a competing action. */}
            {total > 0 && holdNotice && (
              <p className="text-[11px] text-muted-foreground text-center mt-2">{holdNotice}</p>
            )}
          </div>
        </div>
      )}

      {/* Lunch-count mismatch confirm (lightweight, self-contained) — portalled
          to body so the transformed/overflow-hidden event card can't clip it. */}
      {mismatchOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setMismatchOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white border-2 border-[#141414] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold">{lang === "cn" ? "午餐份数与人数不一致" : "Lunch count doesn't match"}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {lang === "cn"
                ? `你有 ${seatCount} 张票，但订购了 ${lunchQty} 份午餐，确定继续吗？`
                : `You have ${seatCount} ticket${seatCount === 1 ? "" : "s"} but ordered ${lunchQty} lunch. Continue?`}
            </p>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setMismatchOpen(false)} className="flex-1 h-10 rounded-xl border-2 border-[#141414] bg-white text-sm font-medium">{lang === "cn" ? "返回修改" : "Go back"}</button>
              <button type="button" onClick={() => { setMismatchOpen(false); setPhase("summary"); }} className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground border-2 border-[#141414] text-sm font-medium">{lang === "cn" ? "确定继续" : "Continue"}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function Row({ l, r, bold }: { l: string; r: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-bold text-foreground" : ""}`}>
      <span>{l}</span>
      <span className="tabular-nums">{r}</span>
    </div>
  );
}

function Stepper({ value, min, max, onChange, disabled }: { value: number; min: number; max: number; onChange: (n: number) => void; disabled?: boolean }) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="flex items-center gap-3">
      <button type="button" disabled={disabled || value <= min} onClick={() => onChange(clamp(value - 1))} className="h-9 w-9 rounded-full border-2 border-[#141414]/40 flex items-center justify-center disabled:opacity-40"><Minus className="w-4 h-4" /></button>
      <span className="min-w-[2ch] text-center text-lg font-bold tabular-nums">{value}</span>
      <button type="button" disabled={disabled || value >= max} onClick={() => onChange(clamp(value + 1))} className="h-9 w-9 rounded-full border-2 border-[#141414]/40 flex items-center justify-center disabled:opacity-40"><Plus className="w-4 h-4" /></button>
    </div>
  );
}

// ── Gates ─────────────────────────────────────────────────────────────────
const QAI_URL = "https://app.qiai.tech/";

/**
 * Cancelled checkout, embedded flow. A throwaway tab: no data, no event list, no
 * path back into browsing here — the customer's real session is the GHL iframe
 * they came from. The close button only appears when an opener exists, because
 * window.close() and the opener reference are governed by the same browser rule;
 * offering a button that silently does nothing is worse than not offering one.
 */
function EmbeddedCancelled({ lang }: { lang: "cn" | "en" }) {
  const hasOpener = (() => {
    try {
      return !!window.opener;
    } catch {
      return false;
    }
  })();
  return (
    <Shell>
      <div className="glass-card rounded-2xl p-6 text-center space-y-3">
        <div className="w-11 h-11 rounded-2xl mx-auto flex items-center justify-center text-[#141414]" style={{ background: "#fed50a" }}>
          <XCircle className="w-6 h-6" />
        </div>
        <p className="text-lg font-bold">{lang === "cn" ? "已取消付款" : "Payment cancelled"}</p>
        <p className="text-sm text-muted-foreground">
          {lang === "cn" ? "请切回上一个标签页继续。" : "Switch back to the previous tab to continue."}
        </p>
        {hasOpener && (
          <button
            type="button"
            onClick={() => window.close()}
            className="h-11 px-5 rounded-full bg-primary text-primary-foreground border-2 border-[#141414] text-sm font-bold"
          >
            {lang === "cn" ? "关闭本页" : "Close this tab"}
          </button>
        )}
      </div>
    </Shell>
  );
}

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
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(QAI_URL).then(done, fallback);
    else fallback();
  }
  return (
    <div className="px-4 sm:px-6 pb-16 pt-24 md:pt-28">
      <div className="max-w-md mx-auto">
        <div className="glass-card rounded-3xl p-8 sm:p-10 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-[#fed50a]" style={{ background: "#141414" }}>
            <CalendarDays className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-display font-bold mb-2">{lang === "cn" ? "线下活动报名" : "Offline Event Booking"}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lang === "cn" ? "请从你的 QAI 后台打开活动报名，这样才能识别你的账号。" : "Please open event booking from your QAI dashboard so we can recognise your account."}
          </p>
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 p-1.5 pl-3">
            <a href={QAI_URL} target="_blank" rel="noreferrer" className="text-sm font-mono truncate flex-1 text-left text-[#141414] hover:underline">{QAI_URL}</a>
            <button type="button" onClick={copy} className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground border-2 border-[#141414] text-xs font-medium px-3 py-1.5 shrink-0 hover:opacity-90 transition-opacity">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? (lang === "cn" ? "已复制" : "Copied") : (lang === "cn" ? "复制" : "Copy")}
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {lang === "cn" ? "打开上面的网址登录 QAI，再从里面进入活动报名。" : "Open the link above, sign in to QAI, then enter event booking from there."}
          </p>
        </div>
      </div>
    </div>
  );
}

function ToolDisabled({ lang }: { lang: "cn" | "en" }) {
  return (
    <div className="px-4 sm:px-6 pb-16 pt-24 md:pt-28">
      <div className="max-w-md mx-auto">
        <div className="glass-card rounded-3xl p-8 sm:p-10 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-[#fed50a]" style={{ background: "#141414" }}>
            <CalendarDays className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-display font-bold mb-2">{lang === "cn" ? "活动报名" : "Event Booking"}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lang === "cn" ? "活动报名暂未对你的账号开放。如需开通，请联系 QAI 管理员。" : "Event booking isn't enabled for your account yet. Please contact your QAI admin to enable it."}
          </p>
        </div>
      </div>
    </div>
  );
}
