import { useEffect, useState, useCallback } from "react";
import {
  CalendarDays,
  Clock,
  Ticket,
  Loader2,
  AlertCircle,
  Check,
  Copy,
  ChevronDown,
  Minus,
  Plus,
  PartyPopper,
  CreditCard,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageContext";
import { resolveLocationId } from "@/lib/ghl";
import { SeatMap } from "@/components/offline-event/SeatMap";
import {
  resolveContext,
  listEvents,
  getEvent,
  createBooking,
  layoutToSeatGroups,
  type OeContext,
  type OeEvent,
  type OeSeatGroup,
  type OeSeat,
  type OePriceBreakdown,
  type OeBooking,
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
    <div className="min-h-screen px-4 sm:px-6 pb-16 pt-24 md:pt-28">
      <div className="max-w-4xl mx-auto">{children}</div>
    </div>
  );
}

// ── Browse events + book ──────────────────────────────────────────────────
function BookingBrowser({ lang, locationId, ctx, onRefreshCtx }: { lang: "cn" | "en"; locationId: string; ctx: OeContext; onRefreshCtx: () => void }) {
  const [events, setEvents] = useState<OeEvent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

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
        <div className="min-w-0">
          <h1 className="text-2xl font-display font-bold leading-tight">{lang === "cn" ? "线下活动报名" : "Offline Event Booking"}</h1>
          <p className="text-sm text-muted-foreground truncate">{ctx.businessName || (lang === "cn" ? "选择活动 · 挑座位 · 报名" : "Pick an event · choose seats · book")}</p>
        </div>
      </div>

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
          ? "选座、价格与免费票额度都由后端核算（前端不直连数据表）。收费订单的在线付款将在下一步开放。"
          : "Seats, pricing and free-ticket allowance are computed server-side (the frontend never touches the tables). Online payment for paid orders arrives next."}
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
          <EventBooking lang={lang} locationId={locationId} ctx={ctx} event={event} readOnly={displayOnly} onBooked={onBooked} />
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
}: {
  lang: "cn" | "en";
  locationId: string;
  ctx: OeContext;
  event: OeEvent;
  readOnly: boolean;
  onBooked: () => void;
}) {
  const seatSelection = event.seat_selection_enabled !== false;
  const [mapState, setMapState] = useState<
    | { kind: "loading" }
    | { kind: "error"; msg: string }
    | { kind: "noplan" }
    | { kind: "ready"; groups: OeSeatGroup[]; columns: number; rows: number; showDoor: boolean }
  >({ kind: "loading" });
  const [selected, setSelected] = useState<SelSeat[]>([]);
  const [qty, setQty] = useState(1); // for seat-selection-disabled events
  const [lunchQty, setLunchQty] = useState(0);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<OeBooking | null>(null);
  const [paid, setPaid] = useState<OePriceBreakdown | null>(null);

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
        setMapState({ kind: "ready", groups, columns: layout.columns, rows: layout.rows, showDoor: layout.door !== "none" });
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

  async function submit() {
    if (seatCount < 1) {
      toast.error(lang === "cn" ? "请先选座" : "Please select a seat");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      toast.error(lang === "cn" ? "请填写有效邮箱" : "Please enter a valid email");
      return;
    }
    setSubmitting(true);
    try {
      const res = await createBooking(locationId, {
        event_id: event.id,
        email: email.trim(),
        seats: seatSelection ? selected.map((s) => s.label) : undefined,
        quantity: seatSelection ? undefined : qty,
        lunch_qty: lunchQty,
      });
      if ("ok" in res && res.ok) {
        setDone(res.booking);
        onBooked();
      } else if ("requiresPayment" in res) {
        setPaid(res.breakdown);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "报名失败";
      if (msg === "seats_unavailable") {
        toast.error(lang === "cn" ? "所选座位刚被订走，请重新选择" : "Those seats were just taken — please pick again");
        setSelected([]);
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

  // ── Success (free booking confirmed) ──
  if (done) {
    return (
      <div className="glass-card rounded-2xl p-6 text-center">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 text-white" style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
          <PartyPopper className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-display font-bold">{lang === "cn" ? "报名成功！" : "You're booked!"}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === "cn" ? "请截图保存下方二维码，活动当天出示签到。" : "Screenshot the QR below and show it at check-in."}
        </p>
        <div className="mt-4 inline-flex flex-col items-center gap-3 rounded-2xl bg-white p-5 border border-border/60">
          <QRCodeSVG value={done.qr_payload} size={180} level="M" includeMargin />
          <p className="text-xs font-mono text-muted-foreground">{done.booking_id}</p>
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          <p>{done.event_label}</p>
          <p className="mt-0.5">{lang === "cn" ? "座位" : "Seats"}: {done.seats.join("、")}</p>
          <p className="mt-0.5 text-emerald-600 font-medium">{lang === "cn" ? "免费报名" : "Free booking"}</p>
        </div>
      </div>
    );
  }

  // ── Paid → payment coming in P5 ──
  if (paid) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold">{lang === "cn" ? "本单需付费" : "Payment required"}</h3>
        </div>
        <div className="text-sm space-y-1 text-muted-foreground">
          <Row l={lang === "cn" ? "座位" : "Seats"} r={`${paid.seatCount}（${lang === "cn" ? "免费" : "free"} ${paid.freeUsedNow} · ${lang === "cn" ? "付费" : "paid"} ${paid.paidSeats}）`} />
          {paid.lunchQty > 0 && <Row l={lang === "cn" ? "午餐" : "Lunch"} r={`${paid.lunchQty} × RM ${paid.lunchPrice.toFixed(2)}`} />}
          <Row l={lang === "cn" ? "小计" : "Subtotal"} r={`RM ${paid.subtotal.toFixed(2)}`} />
          <Row l="SST 8%" r={`RM ${paid.sst.toFixed(2)}`} />
          <div className="border-t border-border/50 my-1.5" />
          <Row l={lang === "cn" ? "合计" : "Total"} r={`RM ${paid.total.toFixed(2)}`} bold />
        </div>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">
          {lang === "cn"
            ? `在线付款即将开放。你有 ${freeRemaining} 张免费票——选不超过 ${freeRemaining} 个座位（且不加午餐）即可免费报名。`
            : `Online payment is coming soon. You have ${freeRemaining} free ticket(s) — pick up to ${freeRemaining} seat(s) (no lunch) to book for free.`}
        </div>
        <button type="button" onClick={() => setPaid(null)} className="mt-3 text-sm font-medium text-primary hover:opacity-80">
          {lang === "cn" ? "← 返回修改" : "← Back to edit"}
        </button>
      </div>
    );
  }

  // ── Booking form (seat select + lunch + email) ──
  return (
    <div className="space-y-4">
      {seatSelection ? (
        mapState.kind === "loading" ? (
          <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : mapState.kind === "error" ? (
          <div className="glass-card rounded-2xl p-6 flex items-start gap-3"><AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" /><p className="text-sm text-muted-foreground">{mapState.msg}</p></div>
        ) : mapState.kind === "noplan" ? (
          <div className="glass-card rounded-2xl p-6 text-center text-sm text-muted-foreground">{lang === "cn" ? "本场暂未设置座位图。" : "No seat map configured yet."}</div>
        ) : (
          <SeatMap
            seatGroups={mapState.groups}
            selectedSeatIds={selected.map((s) => s.id)}
            selectedGroupId={null}
            onToggleSeat={toggleSeat}
            warning={null}
            maxSelectable={cap}
            columns={mapState.columns}
            rows={mapState.rows}
            showDoor={mapState.showDoor}
            readOnly={readOnly}
          />
        )
      ) : (
        <div className="glass-card rounded-2xl p-5">
          <p className="text-sm font-medium mb-2">{lang === "cn" ? "出席人数" : "Attendees"}</p>
          <Stepper value={qty} min={1} max={cap} onChange={setQty} disabled={readOnly} />
        </div>
      )}

      {!readOnly && (
        <>
          {/* Lunch add-on */}
          <div className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{lang === "cn" ? "午餐加购（可选）" : "Lunch add-on (optional)"}</p>
              <p className="text-xs text-muted-foreground">RM {lunchPrice.toFixed(2)} / {lang === "cn" ? "份" : "set"}</p>
            </div>
            <Stepper value={lunchQty} min={0} max={Math.max(seatCount, 0) || 4} onChange={setLunchQty} />
          </div>

          {/* Selected + email + price */}
          <div className="glass-card rounded-2xl p-5 space-y-3">
            {seatSelection && (
              <p className="text-sm">
                {lang === "cn" ? "已选座位" : "Selected"}: {selected.length ? <span className="font-medium">{selected.map((s) => s.label).join("、")}</span> : <span className="text-muted-foreground">{lang === "cn" ? "（请在上方选座）" : "(pick seats above)"}</span>}
              </p>
            )}
            <div>
              <label className="text-sm font-medium">{lang === "cn" ? "邮箱" : "Email"}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            <div className="text-sm space-y-1 pt-1">
              <Row l={lang === "cn" ? "座位" : "Seats"} r={`${seatCount}${freeUsed > 0 ? `（${lang === "cn" ? "免费" : "free"} ${freeUsed}${paidSeats > 0 ? ` · ${lang === "cn" ? "付费" : "paid"} ${paidSeats}` : ""}）` : ""}`} />
              {lunchQty > 0 && <Row l={lang === "cn" ? "午餐" : "Lunch"} r={`${lunchQty} × RM ${lunchPrice.toFixed(2)}`} />}
              {total > 0 && <Row l="SST 8%" r={`RM ${sst.toFixed(2)}`} />}
              <Row l={lang === "cn" ? "合计" : "Total"} r={total > 0 ? `RM ${total.toFixed(2)}` : lang === "cn" ? "免费" : "Free"} bold />
            </div>

            <button
              type="button"
              disabled={submitting || seatCount < 1}
              onClick={submit}
              className="w-full h-11 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {total > 0 ? (lang === "cn" ? "继续（需付费）" : "Continue (payment)") : lang === "cn" ? "确认免费报名" : "Confirm free booking"}
            </button>
          </div>
        </>
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
    <div className="min-h-screen px-4 sm:px-6 pb-16 pt-24 md:pt-28">
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
    <div className="min-h-screen px-4 sm:px-6 pb-16 pt-24 md:pt-28">
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
