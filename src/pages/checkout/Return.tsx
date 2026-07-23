import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, XCircle } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { resolveLocationId } from "@/lib/ghl";
import { confirmBooking, type OeBooking, type OeBookingStatus } from "@/lib/offlineEvent";
import { QrTicket } from "@/components/offline-event/QrTicket";

/**
 * Stripe hosted-Checkout return page (`/checkout/return?booking=BK-…&session=cs_…`).
 *
 * Payment is verified SERVER-SIDE here: confirmBooking retrieves the Checkout
 * session with the secret key and only confirms if Stripe says it's paid — the
 * browser's word is never trusted. We poll it (idempotent) until confirmed
 * (normally the first call). Identity = the location_id stashed in sessionStorage
 * during the booking flow (survives the round-trip to Stripe in the same tab).
 * Confirmed → QR ticket; cancelled → released notice; still pending after ~30s →
 * "if charged, contact support" (rare).
 */
const MAX_TRIES = 15; // ~30s at 2s intervals

export default function CheckoutReturn() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const bookingCode = params.get("booking") || "";
  const sessionId = params.get("session") || "";
  const locationId = resolveLocationId();
  const [status, setStatus] = useState<OeBookingStatus | "loading">("loading");
  const [booking, setBooking] = useState<OeBooking | null>(null);
  const tries = useRef(0);

  useEffect(() => {
    if ((!bookingCode && !sessionId) || !locationId) {
      setStatus("not_found");
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const resp = await confirmBooking(locationId, { session_id: sessionId, booking_code: bookingCode });
        if (!active) return;
        if (resp.status === "confirmed" && resp.booking) {
          setBooking(resp.booking);
          setStatus("confirmed");
          return;
        }
        if (resp.status === "cancelled") {
          setStatus("cancelled");
          return;
        }
        // pending / not_found (payment not visible to Stripe yet) → keep polling
        tries.current += 1;
        if (tries.current >= MAX_TRIES) {
          setStatus("not_found");
          return;
        }
        setStatus("pending");
        timer = setTimeout(poll, 2000);
      } catch {
        if (!active) return;
        tries.current += 1;
        if (tries.current >= MAX_TRIES) {
          setStatus("not_found");
          return;
        }
        timer = setTimeout(poll, 2000);
      }
    };
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [bookingCode, sessionId, locationId]);

  return (
    <div className="min-h-screen px-4 sm:px-6 pb-16 pt-24 md:pt-28">
      <div className="max-w-md mx-auto">
        {status === "confirmed" && booking ? (
          <QrTicket lang={lang} booking={booking} paid onBack={() => navigate("/events")} />
        ) : status === "cancelled" ? (
          <Notice
            icon={<XCircle className="w-6 h-6" />}
            title={lang === "cn" ? "订单已取消" : "Booking cancelled"}
            body={
              lang === "cn"
                ? "这笔订单未完成付款，座位已释放。如仍想参加，请重新报名。"
                : "This booking wasn't paid and the seats were released. Please book again if you still want to attend."
            }
            lang={lang}
          />
        ) : status === "not_found" ? (
          <Notice
            icon={<AlertCircle className="w-6 h-6" />}
            title={lang === "cn" ? "暂时找不到订单" : "Booking not found yet"}
            body={
              lang === "cn"
                ? "我们暂时找不到这笔订单。如果你已经付款但这里没显示，请截图本页并联系 QAI 客服。"
                : "We couldn't find this booking yet. If you were charged but see this, screenshot this page and contact QAI support."
            }
            lang={lang}
          />
        ) : (
          <div className="glass-card rounded-3xl p-8 sm:p-10 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            <h1 className="text-lg font-display font-bold mt-4">{lang === "cn" ? "付款处理中…" : "Processing payment…"}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {lang === "cn"
                ? "正在确认你的付款，请勿关闭页面（通常几秒钟）。"
                : "Confirming your payment — please don't close this page (usually a few seconds)."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Notice({
  icon,
  title,
  body,
  lang,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  lang: "cn" | "en";
}) {
  return (
    <div className="glass-card rounded-3xl p-8 sm:p-10 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-white"
        style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
      >
        {icon}
      </div>
      <h1 className="text-xl font-display font-bold mb-2">{title}</h1>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      <Link
        to="/events"
        className="mt-5 inline-block rounded-full bg-primary text-primary-foreground text-sm font-bold px-5 py-2.5"
      >
        {lang === "cn" ? "返回活动列表" : "Back to events"}
      </Link>
    </div>
  );
}
