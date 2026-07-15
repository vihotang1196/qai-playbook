import { Outlet } from "react-router-dom";
import { Loader2, Building2, AlertTriangle } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { LocationProvider, useLocationContext } from "@/hooks/useLocationContext";
import AdminSidebar from "./AdminSidebar";

/**
 * Layout route for the Review Boost admin. Provides the GHL location context,
 * a top identity strip (which sub-account is being managed), and the sidebar.
 * Sits inside the site <Layout>; in embed mode the site navbar is hidden
 * (see Layout.tsx) so only this shell shows inside the GHL iframe.
 */
export default function ReviewBoostAdminShell() {
  return (
    <LocationProvider>
      <ShellInner />
    </LocationProvider>
  );
}

function ShellInner() {
  const { isEmbed } = useLocationContext();
  return (
    <div className={`min-h-screen px-4 sm:px-6 pb-16 ${isEmbed ? "pt-6" : "pt-20 md:pt-24"}`}>
      <div className="max-w-6xl mx-auto">
        <LocationHeader />
        <div className="flex flex-col md:flex-row gap-5 mt-4">
          <AdminSidebar />
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

function LocationHeader() {
  const { lang } = useLang();
  const { isCustomerView, location, loading, error, locationId } = useLocationContext();

  // Agency view (no location_id) — picker arrives in Phase 3.
  if (!isCustomerView) {
    return (
      <div className="glass-card rounded-2xl px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-display font-semibold text-sm">
            {lang === "cn" ? "Agency 总览" : "Agency overview"}
          </p>
          <p className="text-xs text-muted-foreground">
            {lang === "cn"
              ? "门店选择器将在 Phase 3（从 GHL 同步门店后）出现。"
              : "The location picker arrives in Phase 3, after GHL sync."}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass-card rounded-2xl px-5 py-4 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">
          {lang === "cn" ? "识别门店中…" : "Identifying location…"}
        </p>
      </div>
    );
  }

  if (error || !location) {
    return (
      <div className="glass-card rounded-2xl px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <p className="font-display font-semibold text-sm">
            {lang === "cn" ? "找不到这个门店" : "Location not found"}
          </p>
          <p className="text-xs text-muted-foreground break-all">
            location_id: <span className="font-mono">{locationId || "(none)"}</span>
            {" — "}
            {lang === "cn"
              ? "确认从 GHL 打开、或该门店已同步。"
              : "Open it from GHL, or make sure it's synced."}
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
          {location.business_name || (lang === "cn" ? "(未命名门店)" : "(unnamed location)")}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {location.niche || (lang === "cn" ? "子账号" : "Sub-account")}
          <span className="text-muted-foreground/60"> · {location.location_id}</span>
        </p>
      </div>
    </div>
  );
}
