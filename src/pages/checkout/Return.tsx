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

/** Shared with the booking page. Broadcast only — never a source of truth. */
const CHECKOUT_CHANNEL = "qai-checkout";

/**
 * Tell the (possibly still open) booking tab that this payment landed. Purely an
 * accelerator: the booking page already discovers this by polling the server, so
 * every channel here is best-effort and any failure is silent.
 *
 * BroadcastChannel is the primary path. `window.opener` is a bonus that will
 * usually be gone — Stripe serves COOP headers, which severs the opener
 * relationship for good, so by the time we are back on our own origin the
 * reference is typically null. Nothing may depend on it.
 */
function announcePaid(bookingCode: string, sessionId: string): void {
  const msg = { type: "checkout_success" as const, bookingCode, sessionId };
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel(CHECKOUT_CHANNEL);
      ch.postMessage(msg);
      ch.close();
    }
  } catch {
    /* unsupported / blocked — polling still covers it */
  }
  try {
    // Locked to our own origin, never "*": this payload names a booking.
    window.opener?.postMessage(msg, window.location.origin);
  } catch {
    /* COOP severed the opener, or it is cross-origin — expected, ignore */
  }
}

export default function CheckoutReturn() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const bookingCode = params.get("booking") || "";
  const sessionId = params.get("session") || "";
  // URL FIRST, sessionStorage second. Stripe can't be iframed, so inside GHL
  // checkout opens in a new tab — where sessionStorage (per-tab) is empty. The
  // location therefore has to arrive in the success_url, or a customer who has
  // already paid can never be shown their ticket.
  const locationId = params.get("location_id") || resolveLocationId();
  const [status, setStatus] = useState<OeBookingStatus | "loading">("loading");
  const [booking, setBooking] = useState<OeBooking | null>(null);
  const tries = useRef(0);

  // ── Spawned-tab handling (only when the booking page said embed=1) ────────
  // `hasOpener` decides whether a countdown is even worth showing: window.close()
  // and the opener reference are governed by the same browser rule, so with no
  // opener the close would just fail and the customer would have waited 3s for
  // nothing. Without embed=1 none of this engages and the page behaves exactly
  // as before — ticket shown, never auto-closed.
  const embed = params.get("embed") === "1";
  const hasOpener = (() => {
    try {
      return !!window.opener;
    } catch {
      return false;
    }
  })();
  const autoClose = embed && hasOpener;
  const [countdown, setCountdown] = useState(3);
  const [closeFailed, setCloseFailed] = useState(false);

  const tryClose = () => {
    window.close();
    // If this timer still runs, the close was refused (common after the tab has
    // navigated cross-origin to Stripe and back). Fall back to the ticket.
    setTimeout(() => setCloseFailed(true), 800);
  };

  useEffect(() => {
    if (status !== "confirmed" || !autoClose || closeFailed) return;
    if (countdown <= 0) {
      tryClose();
      return;
    }
    const t = setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [status, autoClose, closeFailed, countdown]);

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
          announcePaid(resp.booking.booking_id || bookingCode, sessionId);
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
    <div className="px-4 sm:px-6 pb-16 pt-24 md:pt-28">
      <div className="max-w-md mx-auto">
        {status === "confirmed" && booking ? (
          // Countdown ONLY while auto-close is still viable. The moment it is
          // refused (or was never possible), fall through to the full ticket —
          // a paid customer must never be left without their QR code.
          autoClose && !closeFailed ? (
            <div className="glass-card rounded-2xl p-6 text-center space-y-3">
              <p className="text-lg font-bold">
                {lang === "cn" ? `✅ 付款成功！${countdown} 秒后自动返回…` : `✅ Payment successful — returning in ${countdown}s…`}
              </p>
              <p className="text-sm text-muted-foreground">
                {lang === "cn" ? "二维码已回到你刚才的页面。" : "Your QR ticket is waiting on the page you came from."}
              </p>
              <button
                type="button"
                onClick={tryClose}
                className="h-11 px-5 rounded-full bg-primary text-primary-foreground border-2 border-[#141414] text-sm font-bold"
              >
                {lang === "cn" ? "立即返回" : "Return now"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {embed && (
                <div className="rounded-xl border-2 border-[#141414] bg-[#fed50a] px-4 py-3 text-sm font-medium text-[#141414]">
                  {lang === "cn"
                    ? "付款成功！本页无法自动关闭，请手动切回上一个标签页查看，或截图保存本页二维码。"
                    : "Payment successful. This tab can't close itself — switch back to the previous tab, or screenshot this QR code."}
                </div>
              )}
              <QrTicket lang={lang} booking={booking} paid onBack={() => navigate("/events")} />
            </div>
          )
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
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-foreground" />
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
        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-[#fed50a]"
        style={{ background: "#141414" }}
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
