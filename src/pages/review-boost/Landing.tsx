import { Link } from "react-router-dom";
import { Megaphone, LayoutDashboard, ArrowRight, Star, Building2 } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { useLocationContext } from "@/hooks/useLocationContext";

/**
 * Review Boost home (`/review-boost`), rendered inside the AdminShell.
 * Context-aware: a sub-account (customer view) gets quick links into its own
 * dashboard/campaigns; the agency root gets a short intro + a Phase-3 note.
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
        <Link to="/review-boost/sub-accounts" className="glass-card rounded-2xl p-5 flex items-center gap-4 group">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
          >
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold">{lang === "cn" ? "子账号" : "Sub-accounts"}</p>
            <p className="text-sm text-muted-foreground">
              {lang === "cn" ? "从 GoHighLevel 同步子账号，选一个进入它的后台。" : "Sync sub-accounts from GoHighLevel and open one."}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>
      )}
    </div>
  );
}
