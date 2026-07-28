import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { CalendarDays, AlertTriangle } from "lucide-react";
import { getSettings, OE_STRIPE_MODE_EVENT, type OeActiveStripe } from "@/lib/offlineEventAdmin";

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
  // ── Always-on Stripe mode badge (MONEY-CRITICAL) ───────────────────────
  // This shell is a LAYOUT route: switching sub-tabs does NOT remount it. The
  // badge used to load once on mount, so after flipping the mode on the Settings
  // tab it kept showing the OLD mode until a full page reload — you could be in
  // LIVE while the badge said Sandbox. That is exactly backwards for something
  // that decides whether real cards get charged.
  //
  // Now it re-reads on every route change inside the tool, whenever the window
  // regains focus, and immediately when Settings announces a change. What it
  // shows is `activeStripe` — resolved server-side by the SAME code a real
  // charge uses — not the raw setting, so the badge cannot claim a mode the
  // charge won't honour.
  const [active, setActive] = useState<OeActiveStripe | null>(null);
  const location = useLocation();

  const refresh = useCallback(() => {
    getSettings()
      .then((r) =>
        setActive(
          r.activeStripe ?? {
            // Older deployments of the fn don't send activeStripe; fall back to
            // the raw setting rather than showing nothing.
            mode: r.settings.stripe_payment_mode,
            keyPrefix: "",
            configured: true,
            secretName: "",
          },
        ),
      )
      .catch(() => {/* badge is best-effort; keep the last known value */});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, location.pathname]);

  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener(OE_STRIPE_MODE_EVENT, onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(OE_STRIPE_MODE_EVENT, onFocus);
    };
  }, [refresh]);

  const mode = active?.mode ?? null;

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
              mode === "live" ? "bg-[#141414] text-[#fed50a]" : "bg-[#fed50a]/25 text-[#141414]"
            }`}
            title="Stripe 付款模式（服务端实时读取）"
          >
            {mode === "live" ? "● 正式模式 Live" : "● 测试模式 Sandbox"}
          </span>
        )}
        {/* The actual secret that a charge would use, right now. Prefix only —
            the key never leaves the server. This is the one-glance proof that
            the badge above matches reality. */}
        {active?.configured && active.keyPrefix && (
          <code
            className="rounded-md border border-[#141414]/20 bg-[#141414]/[0.04] px-1.5 py-0.5 text-[10px] font-mono text-[#141414]"
            title="服务端建 Stripe 会话时实际使用的密钥前缀"
          >
            {active.keyPrefix}…
          </code>
        )}
        {active && !active.configured && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-[#141414] px-2.5 py-1 text-[11px] font-semibold text-[#fed50a]"
            title={`未配置：${active.secretName}`}
          >
            <AlertTriangle className="w-3 h-3" />
            密钥未配置 · 收款会失败
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
