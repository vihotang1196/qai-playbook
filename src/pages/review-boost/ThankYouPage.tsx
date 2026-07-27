import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, PartyPopper } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { getThankYou, type RBThankYou } from "@/lib/reviewBoost";

/**
 * PUBLIC thank-you page (`/thank-you/:generationId`) — shown after the customer
 * taps "I've posted it" (message mode). URL-mode campaigns redirect straight from
 * the scan page and never land here. Mobile-first coral-glass, outside Layout.
 */
export default function ThankYouPage() {
  const { generationId } = useParams();
  const { lang } = useLang();
  const label = (cn: string, en: string) => (lang === "cn" ? cn : en);

  const [data, setData] = useState<RBThankYou | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!generationId) return;
      try {
        const t = await getThankYou(generationId);
        if (!cancelled) setData(t);
      } catch {
        /* fall through to the generic thank-you */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [generationId]);

  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center p-4"
      style={{
        backgroundColor: "#ffffff",
        backgroundImage: "radial-gradient(rgba(20,20,20,0.12) 1.6px, transparent 1.7px)",
        backgroundSize: "26px 26px",
      }}
    >

      <div className="w-full max-w-sm text-center">
        <div className="glass-card rounded-3xl p-8">
          {loading ? (
            <div className="py-6 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <>
              <div
                className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center text-[#fed50a]"
                style={{ background: "#141414" }}
              >
                <PartyPopper className="w-10 h-10" />
              </div>
              {data?.logo_url && (
                <img src={data.logo_url} alt="" className="h-8 object-contain mx-auto mb-3" />
              )}
              <h1 className="text-2xl font-display font-bold mb-2">
                {label("谢谢你的评价！🎉", "Thank you for your review! 🎉")}
              </h1>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {data?.thank_you_message ||
                  label("你的评价已成功发布，非常感谢你的支持！", "Your review has been posted — thank you so much!")}
              </p>
              {data?.business_name && (
                <p className="text-xs text-muted-foreground/70 mt-5">{data.business_name}</p>
              )}
            </>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground/60 mt-6">Powered by QiAi</p>
      </div>
    </div>
  );
}
