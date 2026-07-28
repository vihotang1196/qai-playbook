import { useEffect, useState } from "react";
import { X, Loader2, AlertCircle, CalendarDays, Clock, Ticket, ChevronLeft, QrCode, Mail } from "lucide-react";
import { listMyBookings, type OeMyBooking } from "@/lib/offlineEvent";
import { QrTicket } from "@/components/offline-event/QrTicket";
import { eventTheme } from "@/lib/offlineEventFormat";

/**
 * "My bookings" — the team's tickets for this location. A location is one
 * team/company, so this lists EVERY confirmed booking under the location_id
 * (colleagues share; no email step). Scoping is enforced SERVER-SIDE by
 * location_id — one location never sees another's tickets. Each row shows its
 * booker email so the team can tell whose ticket is whose; tap → big QR for
 * check-in. Self-contained modal overlay (no external UI dep).
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
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<OeMyBooking[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<OeMyBooking | null>(null);

  useEffect(() => {
    let active = true;
    listMyBookings(locationId)
      .then((list) => active && setBookings(list))
      .catch((x) => active && setErr(x instanceof Error ? x.message : lang === "cn" ? "加载失败" : "Failed to load"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [locationId, lang]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm px-4 py-10">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-3xl p-5 sm:p-6 bg-background/95">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-foreground" />
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
                className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-foreground hover:opacity-80"
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
                  ? "本账号（团队）名下的所有报名。点开可看二维码，签到日出示。"
                  : "All bookings under this account (team). Tap one for its check-in QR."}
              </p>

              {loading ? (
                <div className="py-10 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : err ? (
                <div className="py-6 flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              ) : bookings.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  {lang === "cn" ? "这个账号下还没有报名。" : "No bookings under this account yet."}
                </div>
              ) : (
                <div className="space-y-3">
                  {bookings.map((b) => {
                    // en → zh only. Never falls back to event_label (the booking's name snapshot):
                    // that would print the event name where the theme belongs.
                    const theme = eventTheme(b.theme_zh, b.theme_en, lang);
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
                        {b.email && (
                          <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="w-3.5 h-3.5" />
                            {b.email}
                          </p>
                        )}
                        <p className="mt-1.5 text-sm">
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
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
