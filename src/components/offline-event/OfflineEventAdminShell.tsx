import { NavLink, Outlet } from "react-router-dom";
import { CalendarDays } from "lucide-react";

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
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
          style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
        >
          <CalendarDays className="w-4 h-4" />
        </div>
        <h1 className="font-display font-bold text-lg">Offline Event</h1>
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
                  ? "bg-primary/10 text-primary"
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
