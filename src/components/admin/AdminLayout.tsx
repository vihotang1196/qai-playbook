import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { Loader2, ShieldCheck, LogOut } from "lucide-react";
import { whoami, signOut, type AdminIdentity } from "@/lib/adminAuth";

const NAV = [
  { to: "/admin", label: "首页", end: true },
  { to: "/admin/sub-accounts", label: "Sub Account & 权限", end: false },
  { to: "/admin/stats", label: "使用统计", end: false },
  { to: "/admin/audit", label: "审计日志", end: false },
];

/**
 * Guard + shell for every /admin route. On mount it asks the server who the
 * caller is (session JWT → platform_admins allowlist). Not a signed-in admin →
 * bounce to /admin/login. This is a client convenience; the real enforcement is
 * that every admin edge-fn action independently calls requireAdmin().
 *
 * Deliberately OUTSIDE the customer <Layout> and the Review Boost shell — the
 * admin portal shares no chrome or capability with the customer app.
 */
export default function AdminLayout() {
  const loc = useLocation();
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);

  useEffect(() => {
    let cancelled = false;
    whoami()
      .then((a) => {
        if (cancelled) return;
        if (a) {
          setAdmin(a);
          setState("ok");
        } else {
          setState("denied");
        }
      })
      .catch(() => !cancelled && setState("denied"));
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0e1016] text-slate-300">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (state === "denied") {
    return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;
  }

  return (
    <div className="min-h-screen bg-[#0e1016] text-slate-100">
      <header className="border-b border-white/10 px-4 sm:px-6 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}>
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight">Playbook Admin</p>
          <p className="text-[11px] text-slate-400 truncate">{admin?.name || admin?.email}</p>
        </div>
        <nav className="ml-4 hidden sm:flex items-center gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={async () => {
            await signOut();
            window.location.href = "/admin/login";
          }}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-white/15 hover:bg-white/5"
        >
          <LogOut className="w-3.5 h-3.5" /> 登出
        </button>
      </header>
      <main className="px-4 sm:px-6 py-6 max-w-6xl mx-auto">
        <Outlet context={admin} />
      </main>
    </div>
  );
}
