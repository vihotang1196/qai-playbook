import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScanLine, Loader2, AlertCircle, Users, CheckCircle2 } from "lucide-react";
import {
  getCheckinEvents,
  getCheckinBoard,
  checkIn,
  type OeCheckinEvent,
  type OeCheckinBoard,
} from "@/lib/offlineEventAdmin";
import CheckInScanner, { type ScanFeedback } from "@/components/offline-event/CheckInScanner";

/**
 * Offline Event admin — P6 QR check-in (`/admin/offline-event/check-in`).
 *
 * The admin picks the active event + which day, then scans customer ticket QRs
 * (or types the BK code). Every mark goes through the requireAdmin-gated
 * `offline-event-admin` fn, which is idempotent (a re-scan reports "already"
 * and never double-counts) and refuses tickets from another event. The board
 * shows live "已签 X / 共 Y" for the chosen day plus the latest arrivals.
 */

/** Extract the human booking code from a scanned QR (JSON payload) or raw text. */
function extractBookingCode(raw: string): string {
  const s = raw.trim();
  try {
    const o = JSON.parse(s);
    if (o && typeof o.bookingId === "string") return o.bookingId;
  } catch {
    /* not JSON — treat as the code itself (manual entry / plain QR) */
  }
  return s;
}

/** YYYY-MM-DD in local time (matches the date-only event columns). */
function todayStr(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Pick the most likely "current" event: ongoing today → nearest upcoming → last. */
function pickDefaultEvent(events: OeCheckinEvent[]): OeCheckinEvent | null {
  if (events.length === 0) return null;
  const t = todayStr();
  const ongoing = events.find((e) => e.start_date <= t && t <= e.end_date);
  if (ongoing) return ongoing;
  const upcoming = events.filter((e) => e.start_date >= t).sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (upcoming.length) return upcoming[0];
  return events[events.length - 1];
}

function pickDefaultDay(ev: OeCheckinEvent | null): 1 | 2 {
  if (ev && todayStr() === ev.end_date && ev.start_date !== ev.end_date) return 2;
  return 1;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function OfflineEventCheckIn() {
  const [events, setEvents] = useState<OeCheckinEvent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string>("");
  const [day, setDay] = useState<1 | 2>(1);
  const [board, setBoard] = useState<OeCheckinBoard | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [feedback, setFeedback] = useState<ScanFeedback>(null);
  const busyRef = useRef(false);

  const selectedEvent = useMemo(
    () => events?.find((e) => e.id === eventId) ?? null,
    [events, eventId],
  );

  // Load events once, set smart defaults.
  useEffect(() => {
    let cancelled = false;
    getCheckinEvents()
      .then((list) => {
        if (cancelled) return;
        setEvents(list);
        const def = pickDefaultEvent(list);
        if (def) {
          setEventId(def.id);
          setDay(pickDefaultDay(def));
        }
      })
      .catch((e) => !cancelled && setErr(e instanceof Error ? e.message : "加载失败"));
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshBoard = useCallback(() => {
    if (!eventId) return;
    getCheckinBoard(eventId, day)
      .then(setBoard)
      .catch((e) => setErr(e instanceof Error ? e.message : "加载失败"));
  }, [eventId, day]);

  // Refresh the board whenever the event or day changes.
  useEffect(() => {
    setBoard(null);
    setFeedback(null);
    refreshBoard();
  }, [refreshBoard]);

  const handleScan = useCallback(
    async (raw: string) => {
      if (busyRef.current || !eventId) return;
      busyRef.current = true;
      const code = extractBookingCode(raw);
      try {
        const res = await checkIn(code, eventId, day);
        const b = res.booking;
        const who = b ? `${b.email || "（无邮箱）"} · ${b.seats.join("、") || "—"}` : code;
        if (res.result === "ok") {
          setFeedback({ kind: "ok", title: `✅ 签到成功 · Day ${day}`, detail: who });
          refreshBoard();
        } else if (res.result === "already") {
          const at = fmtTime(b?.checkedInAt);
          setFeedback({ kind: "warn", title: `已签到 · Day ${day}${at ? ` (${at})` : ""}`, detail: who });
        } else if (res.result === "wrong_event") {
          setFeedback({
            kind: "error",
            title: "不是本场活动的票",
            detail: `这张票属于「${res.scannedEventLabel || b?.event_label || "其他活动"}」`,
          });
        } else {
          setFeedback({ kind: "error", title: "查无此票", detail: `报名码 ${code}（需为已确认的报名）` });
        }
      } catch (e) {
        setFeedback({ kind: "error", title: "签到失败", detail: e instanceof Error ? e.message : "请重试" });
      } finally {
        busyRef.current = false;
      }
    },
    [eventId, day, refreshBoard],
  );

  if (err && !events) {
    return (
      <div className="glass-card rounded-2xl p-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-sm">加载失败</p>
          <p className="text-sm text-muted-foreground mt-0.5">{err}</p>
        </div>
      </div>
    );
  }

  if (!events) {
    return (
      <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="glass-card rounded-2xl px-6 py-10 text-center text-sm text-muted-foreground">
        还没有活动。请先在「活动日期」创建活动（P7）。
      </div>
    );
  }

  const pct = board && board.total > 0 ? Math.round((board.attended / board.total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Event + day pickers */}
      <div className="glass-card rounded-2xl p-4 space-y-4">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            当前活动（扫码只对这一场生效）
          </label>
          <select
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value);
              const ev = events.find((x) => x.id === e.target.value) ?? null;
              setDay(pickDefaultDay(ev));
            }}
            className="mt-1.5 w-full h-11 rounded-xl border border-border bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.display_label}（{e.start_date} → {e.end_date}）
                {e.status !== "live" ? ` · ${e.status}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">签到日</label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {([1, 2] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={`h-11 rounded-xl text-sm font-semibold transition-colors ${
                  day === d
                    ? "text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
                style={day === d ? { background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" } : undefined}
              >
                Day {d}
                {selectedEvent && (
                  <span className="ml-1.5 text-[11px] font-normal opacity-80">
                    {d === 1 ? selectedEvent.start_date : selectedEvent.end_date}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            setFeedback(null);
            setScannerOpen(true);
          }}
          className="w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
        >
          <ScanLine className="w-5 h-5" /> 开始扫码签到
        </button>
      </div>

      {/* Live board */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
              style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
            >
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Day {day} 签到进度</p>
              <p className="text-2xl font-display font-bold tabular-nums">
                {board ? `${board.attended} / ${board.total}` : "—"}
                <span className="text-sm font-normal text-muted-foreground ml-1">张票</span>
              </p>
            </div>
          </div>
          <span className="text-sm font-semibold text-muted-foreground tabular-nums">{pct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
          />
        </div>
      </div>

      {/* Recent check-ins */}
      <div className="glass-card rounded-2xl p-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          最近签到（Day {day}）
        </p>
        {board && board.recent.length > 0 ? (
          <ul className="space-y-2">
            {board.recent.map((r) => (
              <li key={r.booking_id} className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-medium truncate">{r.email || r.booking_id}</span>
                <span className="text-muted-foreground truncate">{r.seats.join("、")}</span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums shrink-0">
                  {fmtTime(r.checkedInAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">还没有人签到。</p>
        )}
      </div>

      <CheckInScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        feedback={feedback}
        eventLabel={selectedEvent?.display_label}
        day={day}
      />
    </div>
  );
}
