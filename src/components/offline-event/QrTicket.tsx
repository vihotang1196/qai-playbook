import { QRCodeSVG } from "qrcode.react";
import { PartyPopper } from "lucide-react";

/**
 * The confirmed-booking QR e-ticket. Shared by the free-booking success (in
 * EventsPage) and the paid /checkout/return page so both look identical. The
 * customer screenshots the QR; staff scan it at check-in (P6). `paid` defaults
 * to (total > 0) — pass it explicitly if the total isn't loaded yet.
 */
export function QrTicket({
  lang,
  booking,
  paid,
}: {
  lang: "cn" | "en";
  booking: { booking_id: string; qr_payload: string; seats: string[]; event_label: string; total: number };
  paid?: boolean;
}) {
  const isPaid = paid ?? booking.total > 0;
  return (
    <div className="glass-card rounded-2xl p-6 text-center">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 text-white"
        style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
      >
        <PartyPopper className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-display font-bold">{lang === "cn" ? "报名成功！" : "You're booked!"}</h3>
      <p className="text-sm text-muted-foreground mt-1">
        {lang === "cn" ? "请截图保存下方二维码，活动当天出示签到。" : "Screenshot the QR below and show it at check-in."}
      </p>
      <div className="mt-4 inline-flex flex-col items-center gap-3 rounded-2xl bg-white p-5 border border-border/60">
        <QRCodeSVG value={booking.qr_payload} size={180} level="M" includeMargin />
        <p className="text-xs font-mono text-muted-foreground">{booking.booking_id}</p>
      </div>
      <div className="mt-4 text-sm text-muted-foreground">
        <p>{booking.event_label}</p>
        {booking.seats?.length > 0 && (
          <p className="mt-0.5">
            {lang === "cn" ? "座位" : "Seats"}: {booking.seats.join("、")}
          </p>
        )}
        <p className={`mt-0.5 font-medium ${isPaid ? "text-primary" : "text-emerald-600"}`}>
          {isPaid
            ? lang === "cn"
              ? `已付款 RM ${booking.total.toFixed(2)}`
              : `Paid RM ${booking.total.toFixed(2)}`
            : lang === "cn"
              ? "免费报名"
              : "Free booking"}
        </p>
      </div>
    </div>
  );
}
