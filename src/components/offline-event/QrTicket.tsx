import { QRCodeSVG } from "qrcode.react";
import { PartyPopper, ArrowLeft } from "lucide-react";

/**
 * The confirmed-booking QR e-ticket. Shared by the free-booking success (in
 * EventsPage) and the paid /checkout/return page so both look identical. The
 * customer screenshots the QR; staff scan it at check-in (P6). `paid` defaults
 * to (total > 0) — pass it explicitly if the total isn't loaded yet.
 *
 * `onBack` (optional): when provided, a "back to events" button is shown under
 * the ticket. The customer flows pass it (free → collapse back to the list;
 * paid → navigate to /events); the admin detail modal omits it, so nothing
 * changes there.
 */
export function QrTicket({
  lang,
  booking,
  paid,
  onBack,
  backLabel,
}: {
  lang: "cn" | "en";
  booking: { booking_id: string; qr_payload: string; seats: string[]; event_label: string; total: number };
  paid?: boolean;
  onBack?: () => void;
  backLabel?: string;
}) {
  const isPaid = paid ?? booking.total > 0;
  return (
    <div className="glass-card rounded-2xl p-6 text-center">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 text-[#fed50a]"
        style={{ background: "#141414" }}
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
        <p className="mt-0.5 font-medium text-foreground">
          {isPaid
            ? lang === "cn"
              ? `已付款 RM ${booking.total.toFixed(2)}`
              : `Paid RM ${booking.total.toFixed(2)}`
            : lang === "cn"
              ? "免费报名"
              : "Free booking"}
        </p>
      </div>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-4 py-2 text-sm font-medium hover:bg-muted/50"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel ?? (lang === "cn" ? "返回活动列表" : "Back to events")}
        </button>
      )}
    </div>
  );
}
