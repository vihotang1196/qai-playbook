import { useEffect, useState, useCallback, useRef } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageContext";
import { resolveLocationId } from "@/lib/ghl";
import { SeatMap } from "@/components/offline-event/SeatMap";
import { QrTicket } from "@/components/offline-event/QrTicket";
import { MyBookings } from "@/components/offline-event/MyBookings";
import {
  resolveContext,
  listEvents,
  getEvent,
  createBooking,
  createCheckout,
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
  const [locationId] = useState<string>(() => resolveLocationId());
  const [ctx, setCtx] = useState<OeContext | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCtx = useCallback(() => {
    if (!locationId) {
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
  }, [locationId]);

  useEffect(() => {
    loadCtx();
  }, [loadCtx]);

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
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}>
          <CalendarDays className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-display font-bold leading-tight">{lang === "cn" ? "线下活动报名" : "Offline Event Booking"}</h1>
          <p className="text-sm text-muted-foreground truncate">{ctx.businessName || (lang === "cn" ? "选择活动 · 挑座位 · 报名" : "Pick an event · choose seats · book")}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowMine(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-2 text-xs font-bold hover:bg-muted/50"
        >
          <Ticket className="w-3.5 h-3.5 text-primary" />
          {lang === "cn" ? "我的报名" : "My bookings"}
        </button>
      </div>

      {showMine && <MyBookings lang={lang} locationId={locationId} onClose={() => setShowMine(false)} />}

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
            {event.seats_left != null ? (lang === "cn" ? `剩 ${event.seats_left} 座` : `${event.seats_left} left`) : lang === "cn" ? "座位充足" : "seats open"}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-3 sm:px-5 pb-5 pt-1">
          {displayOnly ? (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-sm font-medium text-amber-900 text-center">
              {lang === "cn" ? "此场次已截止报名（仅供查看）" : "Registration closed (view only)"}
            </div>
          ) : null}
          {notice && <p className="mb-3 text-sm text-muted-foreground">{notice}</p>}
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

  // Smooth-scroll to the active step on each step change (skip first mount).
  useEffect(() => {
    if (firstPhase.current) {
      firstPhase.current = false;
      return;
    }
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [phase]);

  const emailValid = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

  // The actual booking call. Server decides free vs paid (authoritative);
  // free → confirmed here, paid → Stripe hosted checkout redirect. Untouched
  // from the pre-step flow except that a seat clash sends the user back to step 1.
  async function doBooking() {
    if (seatCount < 1) return;
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
        toast.message(lang === "cn" ? "正在跳转到付款页…" : "Redirecting to payment…");
        const { checkoutUrl } = await createCheckout(locationId, { ...input, origin: window.location.origin });
        window.location.href = checkoutUrl;
        return; // page navigates away
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
      } else {
        toast.error(msg);
      }
    } finally {
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
      <div className="glass-card rounded-2xl p-6 flex items-start gap-3"><AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" /><p className="text-sm text-muted-foreground">{mapState.msg}</p></div>
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

  return (
    <div ref={rootRef} className="space-y-4">
      {/* ── Step 1: select seats (+ fixed bottom confirm bar) ── */}
      {phase === "selecting" && (
        <>
          <div className="pb-32">{seatArea(true)}</div>

          {createPortal(
            <div className="fixed bottom-0 left-0 right-0 z-40 px-3 sm:px-4 pb-4 pointer-events-none">
            <div className="max-w-4xl mx-auto pointer-events-auto">
              {freeRemaining > 0 && (
                <div className="mb-2 flex justify-center">
                  <span className="inline-flex items-center gap-1 rounded-full bg-background/95 backdrop-blur text-primary text-xs font-bold px-3 py-1 shadow border border-primary/20">
                    <Ticket className="w-3.5 h-3.5" />
                    {lang === "cn" ? `剩余 ${freeRemaining} 张免费门票` : `${freeRemaining} free ticket${freeRemaining === 1 ? "" : "s"} left`}
                  </span>
                </div>
              )}
              <div className="rounded-2xl shadow-xl border border-border/60 bg-background/95 backdrop-blur px-4 py-3 flex items-center gap-3">
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
                  className="shrink-0 h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-bold disabled:opacity-40"
                >
                  {lang === "cn" ? `确认 — ${seatCount} 张票` : `Confirm — ${seatCount}`}
                </button>
              </div>
            </div>
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
              <Utensils className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{lang === "cn" ? "需要加购午餐吗？" : "Would you like to add lunch?"}</p>
                <p className="text-xs text-muted-foreground">RM {lunchPrice.toFixed(2)} / {lang === "cn" ? "份（含两天午餐）" : "set (both days' lunch)"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 text-destructive px-3 py-2 text-sm font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {lang === "cn" ? "注意：午餐不适合素食者。" : "Note: Lunch is not suitable for vegetarians."}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => chooseLunch("no")} className={`h-11 rounded-xl border text-sm font-medium transition-colors ${lunchChoice === "no" ? "border-primary bg-primary/5 text-primary" : "border-border/60 hover:bg-muted/40"}`}>
                {lang === "cn" ? "不用了" : "No thanks"}
              </button>
              <button type="button" onClick={() => chooseLunch("yes")} className={`h-11 rounded-xl border text-sm font-medium transition-colors ${lunchChoice === "yes" ? "border-primary bg-primary/5 text-primary" : "border-border/60 hover:bg-muted/40"}`}>
                {lang === "cn" ? "要加购" : "Add lunch"}
              </button>
            </div>
            {lunchChoice === "yes" && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{lang === "cn" ? "午餐份数" : "Lunch sets"}</p>
                  <Stepper value={lunchQty} min={1} max={Math.max(1, seatCount)} onChange={setLunchQty} />
                </div>
                <button type="button" onClick={confirmAddons} className="w-full h-11 rounded-full bg-primary text-primary-foreground text-sm font-bold">
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
              {lunchQty > 0 && <Row l={lang === "cn" ? "午餐" : "Lunch"} r={`${lunchQty} × RM ${lunchPrice.toFixed(2)}`} />}
              {total > 0 && <Row l="SST 8%" r={`RM ${sst.toFixed(2)}`} />}
              <Row l={lang === "cn" ? "合计" : "Total"} r={total > 0 ? `RM ${total.toFixed(2)}` : lang === "cn" ? "免费" : "Free"} bold />
            </div>
            <div>
              <label className="text-sm font-medium">{lang === "cn" ? "邮箱" : "Email"}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(null); }}
                placeholder="you@example.com"
                className={`mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-primary ${emailError ? "border-destructive" : "border-border/60"}`}
              />
              <p className="text-xs text-muted-foreground mt-1">{lang === "cn" ? "报名成功后二维码门票会显示在下一页，请截图保存。" : "Your QR ticket shows on the next page — screenshot it."}</p>
              {emailError && <p className="text-xs text-destructive mt-1">{emailError}</p>}
            </div>
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive font-medium">
                  {lang === "cn" ? "付款一旦完成，恕不退款。请在继续前仔细确认您的订单。" : "Once payment is made, no refund will be issued. Please review your order carefully before proceeding."}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => { setAcknowledged(e.target.checked); if (policyError) setPolicyError(null); }}
                  className="w-4 h-4 rounded border-border accent-primary"
                />
                {lang === "cn" ? "我已知悉不退款政策" : "I acknowledge the no-refund policy"}
              </label>
              {policyError && <p className="text-xs text-destructive">{policyError}</p>}
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="w-full h-11 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {total > 0
                ? lang === "cn" ? `去付款 RM ${total.toFixed(2)}` : `Pay RM ${total.toFixed(2)}`
                : lang === "cn" ? "确认免费报名" : "Confirm free booking"}
            </button>
          </div>
        </div>
      )}

      {/* Lunch-count mismatch confirm (lightweight, self-contained) — portalled
          to body so the transformed/overflow-hidden event card can't clip it. */}
      {mismatchOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setMismatchOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold">{lang === "cn" ? "午餐份数与人数不一致" : "Lunch count doesn't match"}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {lang === "cn"
                ? `你有 ${seatCount} 张票，但订购了 ${lunchQty} 份午餐，确定继续吗？`
                : `You have ${seatCount} ticket${seatCount === 1 ? "" : "s"} but ordered ${lunchQty} lunch. Continue?`}
            </p>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setMismatchOpen(false)} className="flex-1 h-10 rounded-xl bg-muted text-sm font-medium">{lang === "cn" ? "返回修改" : "Go back"}</button>
              <button type="button" onClick={() => { setMismatchOpen(false); setPhase("summary"); }} className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium">{lang === "cn" ? "确定继续" : "Continue"}</button>
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
      <button type="button" disabled={disabled || value <= min} onClick={() => onChange(clamp(value - 1))} className="h-9 w-9 rounded-full border border-border/60 flex items-center justify-center disabled:opacity-40"><Minus className="w-4 h-4" /></button>
      <span className="min-w-[2ch] text-center text-lg font-bold tabular-nums">{value}</span>
      <button type="button" disabled={disabled || value >= max} onClick={() => onChange(clamp(value + 1))} className="h-9 w-9 rounded-full border border-border/60 flex items-center justify-center disabled:opacity-40"><Plus className="w-4 h-4" /></button>
    </div>
  );
}

// ── Gates ─────────────────────────────────────────────────────────────────
const QAI_URL = "https://app.qiai.tech/";

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
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-white" style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}>
            <CalendarDays className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-display font-bold mb-2">{lang === "cn" ? "线下活动报名" : "Offline Event Booking"}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lang === "cn" ? "请从你的 QAI 后台打开活动报名，这样才能识别你的账号。" : "Please open event booking from your QAI dashboard so we can recognise your account."}
          </p>
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 p-1.5 pl-3">
            <a href={QAI_URL} target="_blank" rel="noreferrer" className="text-sm font-mono truncate flex-1 text-left text-primary hover:underline">{QAI_URL}</a>
            <button type="button" onClick={copy} className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 shrink-0 hover:opacity-90 transition-opacity">
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
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-white" style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}>
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
