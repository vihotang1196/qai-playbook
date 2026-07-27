import { useEffect, useState } from "react";
import { X, Loader2, CheckCircle2, UserPlus } from "lucide-react";
import {
  listLocations,
  getCheckinEvents,
  addBooking,
  type OeLocation,
  type OeCheckinEvent,
} from "@/lib/offlineEventAdmin";
import AdminSeatPicker from "./AdminSeatPicker";

/**
 * Manual add-ticket (owner: some customers pay via a 3rd party / offline). Admin
 * picks the sub-account + event + seats, enters email + amount + note, and a
 * CONFIRMED booking is created (seats claimed atomically; no free-allowance
 * spend; no Stripe — payment is a note). The customer then has a QR to check in.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

const MAX_SEATS = 4; // owner rule: max 4 per booking

export default function ManualAddModal({ open, onClose, onDone }: Props) {
  const [locations, setLocations] = useState<OeLocation[]>([]);
  const [events, setEvents] = useState<OeCheckinEvent[]>([]);
  const [locationId, setLocationId] = useState("");
  const [eventId, setEventId] = useState("");
  const [seats, setSeats] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [lunchQty, setLunchQty] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // reset
    setLocationId(""); setEventId(""); setSeats([]); setEmail(""); setPhone("");
    setAmount(""); setNote(""); setLunchQty("0"); setErr(null); setSuccessCode(null);
    Promise.all([listLocations(), getCheckinEvents()])
      .then(([locs, evs]) => { setLocations(locs); setEvents(evs); })
      .catch((e) => setErr(e instanceof Error ? e.message : "加载失败"));
  }, [open]);

  if (!open) return null;

  const canSubmit = locationId && eventId && seats.length > 0 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && !submitting;

  const submit = async () => {
    setErr(null);
    setSubmitting(true);
    try {
      const r = await addBooking({
        locationId, eventId, seats, email, phone: phone || undefined,
        amount: Number(amount) || 0, note: note || undefined, lunchQty: Number(lunchQty) || 0,
      });
      setSuccessCode(r.booking.booking_id);
      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加票失败";
      setErr(msg === "seats_unavailable" ? "所选座位已被占用，请换座位。" : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-3xl bg-background shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0 bg-background z-10 border-b border-border/40">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-foreground" />
            <p className="font-display font-bold">手动加票（第三方 / 线下付款）</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {successCode ? (
          <div className="p-8 flex flex-col items-center text-center gap-3">
            <CheckCircle2 className="w-12 h-12 text-[#141414]" />
            <p className="font-semibold">已创建报名</p>
            <p className="font-mono text-sm">{successCode}</p>
            <p className="text-sm text-muted-foreground">已确认票，顾客可在「我的报名」看到二维码用于签到。</p>
            <button onClick={onClose} className="mt-2 h-10 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-medium">完成</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">子账号（哪个客户）</label>
                <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="mt-1 w-full h-10 rounded-xl border border-border bg-background px-3 text-sm">
                  <option value="">选择子账号…</option>
                  {locations.map((l) => (
                    <option key={l.location_id} value={l.location_id}>{l.business_name || l.location_id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">活动</label>
                <select value={eventId} onChange={(e) => { setEventId(e.target.value); setSeats([]); }} className="mt-1 w-full h-10 rounded-xl border border-border bg-background px-3 text-sm">
                  <option value="">选择活动…</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.display_label}</option>
                  ))}
                </select>
              </div>
            </div>

            {eventId ? (
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  选座（最多 {MAX_SEATS}，已选 {seats.length}）
                </label>
                <div className="mt-1 max-h-[46vh] overflow-auto rounded-2xl">
                  <AdminSeatPicker eventId={eventId} maxSelectable={MAX_SEATS} onChange={setSeats} />
                </div>
                {seats.length > 0 && <p className="text-xs text-muted-foreground mt-1">已选：{seats.join("、")}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">先选活动，再选座位。</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">顾客邮箱</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="mt-1 w-full h-10 rounded-xl border border-border bg-background px-3 text-sm" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">电话（选填）</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full h-10 rounded-xl border border-border bg-background px-3 text-sm" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">实收金额 RM（选填）</label>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="mt-1 w-full h-10 rounded-xl border border-border bg-background px-3 text-sm" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">午餐份数（选填）</label>
                <input value={lunchQty} onChange={(e) => setLunchQty(e.target.value)} inputMode="numeric" className="mt-1 w-full h-10 rounded-xl border border-border bg-background px-3 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">付款备注（如：银行转账 RM857 / 现金）</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="第三方 / 线下付款说明" className="mt-1 w-full h-10 rounded-xl border border-border bg-background px-3 text-sm" />
              </div>
            </div>

            {err && <p className="text-sm text-destructive">{err}</p>}

            <div className="flex gap-2 pt-2 border-t border-border/40">
              <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-muted text-sm font-medium">取消</button>
              <button
                onClick={submit}
                disabled={!canSubmit}
                className="flex-1 h-11 rounded-xl text-[#141414] text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
                style={{ background: "#fed50a" }}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                创建已确认票
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
