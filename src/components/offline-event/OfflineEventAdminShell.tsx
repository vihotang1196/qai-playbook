import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { getSettings } from "@/lib/offlineEventAdmin";

/**
 * Offline Event admin — nested INSIDE the Admin Portal at `/admin/offline-event/*`.
 * Renders inside <AdminLayout> (which provides the one requireAdmin guard + the
 * coral-glass chrome + top nav). This shell only adds the tool's own sub-tab
 * navigation and an <Outlet> for each section.
 *
 * The real per-action security is server-side: every write/read goes through the
 * requireAdmin-gated `offline-event-admin` edge fn (built from P2 onwards) — the
 * frontend never touches the RLS-locked oe_ tables directly.
 */
const SUBNAV = [
  { to: "/admin/offline-event", label: "总览", end: true },
  { to: "/admin/offline-event/bookings", label: "报名", end: false },
  { to: "/admin/offline-event/event-dates", label: "活动日期", end: false },
  { to: "/admin/offline-event/floor-plans", label: "平面图", end: false },
  { to: "/admin/offline-event/check-in", label: "签到", end: false },
  { to: "/admin/offline-event/settings", label: "设置", end: false },
];

export default function OfflineEventAdminShell() {
  // Always-on Stripe mode badge — one glance tells you test vs. live everywhere
  // in the Offline Event admin. Re-fetched when the route re-mounts the shell.
  const [mode, setMode] = useState<"sandbox" | "live" | null>(null);
  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((r) => !cancelled && setMode(r.settings.stripe_payment_mode))
      .catch(() => {/* badge is best-effort */});
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-[#fed50a] shrink-0"
          style={{ background: "#141414" }}
        >
          <CalendarDays className="w-4 h-4" />
        </div>
        <h1 className="font-display font-bold text-lg">Offline Event</h1>
        {mode && (
          <span
            className={`ml-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              mode === "live" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
            }`}
            title="Stripe 付款模式"
          >
            {mode === "live" ? "● 正式模式 Live" : "● 测试模式 Sandbox"}
          </span>
        )}
      </div>

      <nav className="flex flex-wrap items-center gap-1 mb-6 border-b border-border/50 pb-2">
        {SUBNAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            {n.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
