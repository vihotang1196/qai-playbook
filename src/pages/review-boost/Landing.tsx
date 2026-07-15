import { Link } from "react-router-dom";
import { Megaphone, LayoutDashboard, ArrowRight, Star, Info } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { useLocationContext } from "@/hooks/useLocationContext";

/**
 * Review Boost home (`/review-boost`), rendered inside the AdminShell.
 * CUSTOMER app only: with a location_id (opened from GHL) it links into that
 * sub-account's own pages; without one it just explains how to open the tool.
 * NO agency/cross-client view here — that lives in the authenticated Admin Portal.
 */
export default function ReviewBoostLanding() {
  const { lang } = useLang();
  const { isCustomerView, locationId } = useLocationContext();

  const intro =
    lang === "cn"
      ? "顾客扫码 → AI 当场写好五星评价 → 一键跳去 Google／Facebook／Shopee 发布。帮商家快速累积真实好评。"
      : "Customers scan → AI writes a 5-star review on the spot → one tap to post it on Google / Facebook / Shopee.";

  return (
    <div className="space-y-5">
      <div className="glass-card rounded-3xl p-6 sm:p-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 text-white"
          style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
        >
          <Star className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold mb-2">Review Boost</h1>
        <p className="text-muted-foreground leading-relaxed max-w-2xl">{intro}</p>
      </div>

      {isCustomerView && locationId ? (
        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            to={`/review-boost/location/${locationId}/dashboard`}
            className="glass-card rounded-2xl p-5 flex items-center gap-4 group"
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
            >
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold">{lang === "cn" ? "面板" : "Dashboard"}</p>
              <p className="text-sm text-muted-foreground">{lang === "cn" ? "扫码与评价统计" : "Scan & review stats"}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
          <Link
            to={`/review-boost/location/${locationId}/campaigns`}
            className="glass-card rounded-2xl p-5 flex items-center gap-4 group"
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
            >
              <Megaphone className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold">{lang === "cn" ? "活动" : "Campaigns"}</p>
              <p className="text-sm text-muted-foreground">{lang === "cn" ? "建立与管理二维码" : "Create & manage QR codes"}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-5 flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lang === "cn"
              ? "请从你的 GoHighLevel 后台打开这个工具——它会自动带上你的身份，进入你自己的后台。"
              : "Open this tool from your GoHighLevel account — it loads your own admin automatically."}
          </p>
        </div>
      )}
    </div>
  );
}
