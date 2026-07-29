import { useEffect, useState } from "react";
import { X, Loader2, ArchiveRestore, AlertTriangle } from "lucide-react";
import { archiveBooking, getEventSeatmap, type OeBookingRow } from "@/lib/offlineEventAdmin";
import AdminSeatPicker from "./AdminSeatPicker";

/**
 * Un-archive one booking, choosing its seats (batch 7a).
 *
 * Archiving now releases the seats, so un-archiving cannot just flip the flag —
 * the original seats may have been sold in the meantime. We show what the
 * original seats were and whether they are still free: free ones come
 * pre-selected (AdminSeatPicker skips any that aren't), taken ones are named
 * along with the booking that holds them, so "why can't I have my seat back" has
 * an answer on screen.
 *
 * Deliberately NOT built on SeatOpModal: that one is wired to changeSeats /
 * changeEvent and carries a change-date dropdown. Only the picker is shared.
 */
export default function UnarchiveModal({
  booking,
  onClose,
  onDone,
}: {
  booking: OeBookingRow;
  onClose: () => void;
  onDone: () => void;
}) {
  // A cancelled booking holds no seats by design, so un-archiving it claims
  // nothing and there is nothing to pick (the server skips the claim too).
  const needsSeats = booking.status !== "cancelled" && !!booking.event_id && booking.seats.length > 0;
  const required = needsSeats ? booking.seats.length : 0;
  const [seats, setSeats] = useState<string[]>([]);
  const [taken, setTaken] = useState<Record<string, string>>({});
  const [loadingTaken, setLoadingTaken] = useState(needsSeats);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Which of the ORIGINAL seats are gone, and to whom. The picker already hides
  // them; this is what turns "you can't pick that" into "BK-XXXX has it".
  useEffect(() => {
    let cancelled = false;
    if (!needsSeats || !booking.event_id) {
      setLoadingTaken(false);
      return;
    }
    getEventSeatmap(booking.event_id)
      .then((r) => {
        if (cancelled) return;
        const holders: Record<string, string> = {};
        for (const label of booking.seats) {
          if ((r.bookedLabels ?? []).includes(label)) holders[label] = r.bookedBy?.[label] ?? "";
        }
        setTaken(holders);
      })
      .catch(() => {/* the picker still works; we just can't annotate */})
      .finally(() => !cancelled && setLoadingTaken(false));
    return () => {
      cancelled = true;
    };
  }, [booking.event_id, booking.seats, needsSeats]);

  const takenLabels = Object.keys(taken);
  const canSubmit = seats.length === required && !submitting;

  const submit = async () => {
    setErr(null);
    setSubmitting(true);
    try {
      await archiveBooking(booking.booking_id, false, seats);
      onDone();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "操作失败";
      setErr(
        msg === "seats_unavailable"
          ? "所选座位刚刚被别人订走了，请重新选座。（这笔报名仍是已归档状态，没有变动。）"
          : msg === "seat_count_mismatch"
            ? `座位数必须为 ${required}`
            : msg,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={() => !submitting && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-3xl rounded-3xl bg-background shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0 bg-background z-10 border-b border-border/40">
          <div className="flex items-center gap-2">
            <ArchiveRestore className="w-5 h-5 text-foreground" />
            <div>
              <p className="font-display font-bold">取消归档 · 选座位</p>
              <p className="text-[11px] text-muted-foreground">
                {booking.booking_id} · 需选 {required} 个座位（金额不变）
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {/* Why there is a seat picker here at all. */}
          <div className="rounded-2xl border-2 border-[#141414] bg-[#fed50a]/20 px-4 py-3 text-sm">
            <p>
              归档时这笔报名的座位<b className="text-[#141414]">已经被释放</b>，
              所以取消归档要重新占座。
            </p>
            <p className="mt-1.5 text-[13px]">
              原座位：<b className="text-[#141414] font-mono">{booking.seats.join("、") || "—"}</b>
            </p>
            {loadingTaken ? (
              <p className="mt-1 text-[12px] text-muted-foreground inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> 正在查原座位是否还空着…
              </p>
            ) : takenLabels.length === 0 ? (
              <p className="mt-1 text-[12px] text-muted-foreground">
                原座位仍然空着，已默认勾选 —— 也可以改选别的。
              </p>
            ) : (
              <div className="mt-1 text-[12px] font-semibold text-[#141414]">
                <p className="inline-flex items-start gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  以下原座位已被占用，必须重新选：
                </p>
                {takenLabels.map((label) => (
                  <span key={label} className="block font-mono ml-4">
                    · {label}
                    {taken[label] ? ` 已被 ${taken[label]} 占用` : " 已被占用"}
                  </span>
                ))}
              </div>
            )}
          </div>

          {!needsSeats ? (
            <p className="text-sm text-muted-foreground">
              {booking.status === "cancelled"
                ? "这笔报名是「已取消」状态，本来就不占座位，取消归档不会重新占座。"
                : `这笔报名没有座位${!booking.event_id ? "（也没有关联活动）" : ""}，直接取消归档即可。`}
            </p>
          ) : (
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                选座（需 {required}，已选 {seats.length}）
              </label>
              <div className="mt-1 max-h-[52vh] overflow-auto rounded-2xl">
                <AdminSeatPicker
                  eventId={booking.event_id!}
                  maxSelectable={required}
                  initialLabels={booking.seats}
                  onChange={setSeats}
                />
              </div>
              {seats.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">已选：{seats.join("、")}</p>
              )}
            </div>
          )}

          {err && <p className="text-sm text-destructive">{err}</p>}

          <div className="flex gap-2 pt-2 border-t border-border/40">
            <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-muted text-sm font-medium">
              返回
            </button>
            <button
              onClick={submit}
              disabled={required > 0 ? !canSubmit : submitting}
              className="flex-1 h-11 rounded-xl text-[#141414] text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
              style={{ background: "#fed50a" }}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              确认取消归档
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
