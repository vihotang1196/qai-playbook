import { useCallback, useEffect, useState } from "react";
import { X, Loader2, AlertCircle, CalendarDays, Clock, Ticket, ChevronLeft, QrCode } from "lucide-react";
import { listMyBookings, getStoredBookingEmail, rememberBookingEmail, type OeMyBooking } from "@/lib/offlineEvent";
import { QrTicket } from "@/components/offline-event/QrTicket";

/**
 * "My bookings" — a customer re-finds their own tickets to show the QR at
 * check-in. Scope A: matched SERVER-SIDE by (location_id + email); a different
 * email never appears, so students under one sub-account don't see each other's
 * tickets. The last-booked email is remembered per browser and auto-loaded.
 * Renders as a self-contained modal overlay (no external UI dep).
 */
export function MyBookings({
  lang,
  locationId,
  onClose,
}: {
  lang: "cn" | "en";
  locationId: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState<string>(() => getStoredBookingEmail());
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [bookings, setBookings] = useState<OeMyBooking[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<OeMyBooking | null>(null);

  const search = useCallback(
    async (addr: string) => {
      const e = addr.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
        setErr(lang === "cn" ? "请填写有效邮箱" : "Please enter a valid email");
        return;
      }
      setErr(null);
      setLoading(true);
      try {
        const list = await listMyBookings(locationId, e);
        rememberBookingEmail(e);
        setBookings(list);
        setSearched(true);
      } catch (x) {
        setErr(x instanceof Error ? x.message : lang === "cn" ? "查询失败" : "Lookup failed");
      } finally {
        setLoading(false);
      }
    },
    [locationId, lang],
  );

  // Auto-load if we already remember an email from a prior booking.
  useEffect(() => {
    const remembered = getStoredBookingEmail();
    if (remembered) search(remembered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm px-4 py-10">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-3xl p-5 sm:p-6 bg-background/95">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-display font-bold">{lang === "cn" ? "我的报名" : "My bookings"}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={lang === "cn" ? "关闭" : "Close"}
              className="h-8 w-8 rounded-full border border-border/60 flex items-center justify-center hover:bg-muted/50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {selected ? (
            <div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:opacity-80"
              >
                <ChevronLeft className="w-4 h-4" />
                {lang === "cn" ? "返回列表" : "Back to list"}
              </button>
              <QrTicket
                lang={lang}
                booking={{
                  booking_id: selected.booking_id,
                  qr_payload: selected.qr_payload,
                  seats: selected.seats,
                  event_label: selected.event_label,
                  total: selected.total,
                }}
                paid={selected.total > 0}
              />
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                {lang === "cn"
                  ? "输入你报名时用的邮箱，查回你的票（只显示你自己的）。"
                  : "Enter the email you booked with to see your tickets (only your own)."}
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search(email)}
                  placeholder="you@example.com"
                  className="flex-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => search(email)}
                  className="rounded-xl bg-primary text-primary-foreground text-sm font-bold px-4 shrink-0 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {lang === "cn" ? "查询" : "Find"}
                </button>
              </div>

              {err && (
                <div className="mt-3 flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              )}

              <div className="mt-4 space-y-3">
                {loading ? (
                  <div className="py-8 flex items-center justify-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : searched && bookings.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {lang === "cn" ? "这个邮箱下没有找到报名。" : "No bookings found for this email."}
                  </div>
                ) : (
                  bookings.map((b) => {
                    const theme = (lang === "cn" ? b.theme_zh : b.theme_en) || b.event_label;
                    return (
                      <div key={b.booking_id} className="rounded-2xl border border-border/60 p-4">
                        <p className="font-display font-semibold text-sm">{theme}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {b.event_label}
                          </span>
                          {b.time_slot && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {b.time_slot}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm">
                          {lang === "cn" ? "座位" : "Seats"}: <span className="font-medium">{b.seats.join("、")}</span>
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-xs font-mono text-muted-foreground">{b.booking_id}</span>
                          <button
                            type="button"
                            onClick={() => setSelected(b)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 hover:opacity-90"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            {lang === "cn" ? "查看二维码" : "Show QR"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
