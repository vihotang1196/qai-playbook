import { useState } from "react";
import { X, Loader2, Armchair, CalendarClock } from "lucide-react";
import { changeSeats, changeEvent, type OeCheckinEvent } from "@/lib/offlineEventAdmin";
import AdminSeatPicker from "./AdminSeatPicker";

/**
 * Change-seat (same event) or change-date (move to another event) for one
 * booking. Seat count is fixed to the original (money untouched — owner rule).
 * The atomic RPCs swap old↔new seats in one txn, so a collision keeps the old
 * seats. Booking code is unchanged, so the customer's existing QR still scans.
 */

interface Props {
  open: boolean;
  mode: "seat" | "date";
  booking: { booking_id: string; event_id: string | null; event_label: string; seats: string[] };
  events: OeCheckinEvent[];
  onClose: () => void;
  onDone: () => void;
}

export default function SeatOpModal({ open, mode, booking, events, onClose, onDone }: Props) {
  const required = booking.seats.length;
  const [targetEventId, setTargetEventId] = useState<string>(booking.event_id ?? "");
  const [seats, setSeats] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const eventForPicker = mode === "seat" ? (booking.event_id ?? "") : targetEventId;
  const canSubmit = eventForPicker && seats.length === required && !submitting;

  const submit = async () => {
    setErr(null);
    setSubmitting(true);
    try {
      if (mode === "seat") {
        await changeSeats(booking.booking_id, seats);
      } else {
        await changeEvent(booking.booking_id, targetEventId, seats);
      }
      onDone();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "操作失败";
      setErr(msg === "seats_unavailable" ? "所选座位已被占用，请换座位。" : msg === "seat_count_mismatch" ? `座位数必须为 ${required}` : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-3xl bg-background shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0 bg-background z-10 border-b border-border/40">
          <div className="flex items-center gap-2">
            {mode === "seat" ? <Armchair className="w-5 h-5 text-primary" /> : <CalendarClock className="w-5 h-5 text-primary" />}
            <div>
              <p className="font-display font-bold">{mode === "seat" ? "改座位" : "改期（换活动）"}</p>
              <p className="text-[11px] text-muted-foreground">{booking.booking_id} · 需选 {required} 个座位（金额不变）</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {mode === "date" && (
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">换到活动</label>
              <select
                value={targetEventId}
                onChange={(e) => { setTargetEventId(e.target.value); setSeats([]); }}
                className="mt-1 w-full h-10 rounded-xl border border-border bg-background px-3 text-sm"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.display_label}{ev.id === booking.event_id ? "（当前）" : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">
                已尽量勾选相同座位号；若新活动那些座位已被占，请手动改选。金额按规则不变。
              </p>
            </div>
          )}

          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              选座（需 {required}，已选 {seats.length}）
            </label>
            <div className="mt-1 max-h-[52vh] overflow-auto rounded-2xl">
              {eventForPicker ? (
                <AdminSeatPicker
                  key={eventForPicker}
                  eventId={eventForPicker}
                  excludeBookingId={booking.booking_id}
                  maxSelectable={required}
                  initialLabels={booking.seats}
                  onChange={setSeats}
                />
              ) : (
                <p className="text-sm text-muted-foreground p-4">请先选择活动。</p>
              )}
            </div>
            {seats.length > 0 && <p className="text-xs text-muted-foreground mt-1">已选：{seats.join("、")}</p>}
          </div>

          {err && <p className="text-sm text-destructive">{err}</p>}

          <div className="flex gap-2 pt-2 border-t border-border/40">
            <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-muted text-sm font-medium">取消</button>
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="flex-1 h-11 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              确认{mode === "seat" ? "改座" : "改期"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
