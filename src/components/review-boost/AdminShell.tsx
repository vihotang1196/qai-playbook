import { Outlet } from "react-router-dom";
import { Loader2, Building2, AlertTriangle, Lock } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { LocationProvider, useLocationContext } from "@/hooks/useLocationContext";
import AdminSidebar from "./AdminSidebar";

/**
 * Layout route for the Review Boost customer admin. Provides the GHL location
 * context, a top identity strip (business name + location id), and the sidebar.
 * Sits inside the site <Layout> (which now always shows the Playbook navbar).
 *
 * Customer-facing: no agency "Sub Account" wording here — that term is only used
 * in the (separate) Admin Portal.
 */
export default function ReviewBoostAdminShell() {
  return (
    <LocationProvider>
      <ShellInner />
    </LocationProvider>
  );
}

function ShellInner() {
  const { isCustomerView, toolEnabled } = useLocationContext();
  const blocked = isCustomerView && toolEnabled === false;
  return (
    <div className="min-h-screen px-4 sm:px-6 pb-16 pt-20 md:pt-24">
      <div className="max-w-6xl mx-auto">
        <LocationHeader />
        {blocked ? (
          <ToolDisabled />
        ) : (
          <div className="flex flex-col md:flex-row gap-5 mt-4">
            <AdminSidebar />
            <main className="flex-1 min-w-0">
              <Outlet />
            </main>
          </div>
        )}
      </div>
    </div>
  );
}

/** Whole-app block when the Admin Portal has turned Review Boost off here. */
function ToolDisabled() {
  const { lang } = useLang();
  return (
    <div className="glass-card rounded-3xl px-6 py-12 mt-4 flex flex-col items-center text-center gap-3">
      <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center">
        <Lock className="w-7 h-7 text-muted-foreground" />
      </div>
      <p className="font-display font-semibold text-lg">
        {lang === "cn" ? "Review Boost 尚未对你开放" : "Review Boost isn't available yet"}
      </p>
      <p className="text-sm text-muted-foreground max-w-sm">
        {lang === "cn" ? "请联系管理员开通。" : "Please contact your administrator to enable it."}
      </p>
    </div>
  );
}

function LocationHeader() {
  const { lang } = useLang();
  const { isCustomerView, location, loading, error, locationId } = useLocationContext();

  // No location_id → not opened from GoHighLevel. Neutral state only.
  if (!isCustomerView) {
    return (
      <div className="glass-card rounded-2xl px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-display font-semibold text-sm">Review Boost</p>
          <p className="text-xs text-muted-foreground">
            {lang === "cn"
              ? "请从你的 QAI 后台打开此工具。"
              : "Open this tool from your QAI account."}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass-card rounded-2xl px-5 py-4 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-[#141414] animate-spin" />
        <p className="text-sm text-muted-foreground">{lang === "cn" ? "加载中…" : "Loading…"}</p>
      </div>
    );
  }

  if (error || !location) {
    return (
      <div className="glass-card rounded-2xl px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#141414] flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-[#fed50a]" />
        </div>
        <div>
          <p className="font-display font-semibold text-sm">
            {lang === "cn" ? "找不到这个商家" : "Business not found"}
          </p>
          <p className="text-xs text-muted-foreground break-all">
            location_id: <span className="font-mono">{locationId || "(none)"}</span>
            {" — "}
            {lang === "cn"
              ? "请从你的 QAI 后台重新打开。"
              : "Please reopen it from your QAI account."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl px-5 py-4 flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl bg-white shadow-sm border border-border/40 flex items-center justify-center overflow-hidden shrink-0">
        {location.logo_url ? (
          <img src={location.logo_url} alt="" className="w-full h-full object-contain" />
        ) : (
          <Building2 className="w-5 h-5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0">
        <p className="font-display font-semibold text-sm truncate">
          {location.business_name || (lang === "cn" ? "(未命名)" : "(unnamed)")}
        </p>
        {/* Business name over the raw location id — no agency wording. */}
        <p className="text-xs text-muted-foreground truncate font-mono">{location.location_id}</p>
      </div>
    </div>
  );
}
