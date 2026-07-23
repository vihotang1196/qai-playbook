import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { Loader2, ShieldCheck, LogOut } from "lucide-react";
import { whoami, signOut, type AdminIdentity } from "@/lib/adminAuth";

const NAV = [
  { to: "/admin", label: "首页", end: true },
  { to: "/admin/sub-accounts", label: "Sub Account & 权限", end: false },
  { to: "/admin/offline-event", label: "Offline Event", end: false },
  { to: "/admin/helpdesk", label: "Helpdesk", end: false },
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
      <div className="min-h-screen flex items-center justify-center bg-[#FCFDFF] text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (state === "denied") {
    return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden text-foreground">
      <AdminBackground />
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/60 border-b border-border/50 px-4 sm:px-6 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}>
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="font-display font-semibold text-sm leading-tight">Playbook Admin</p>
          <p className="text-[11px] text-muted-foreground truncate">{admin?.name || admin?.email}</p>
        </div>
        <nav className="ml-4 hidden sm:flex items-center gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
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
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
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

/** Light coral-glass ambient background, matching the Playbook / RB client. */
function AdminBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-[#FCFDFF]">
      <div className="absolute -top-[15vh] -left-[10vw] w-[60vw] h-[60vh] rounded-full bg-[#FCE4F1] opacity-30 blur-[100px]" />
      <div className="absolute -top-[12vh] -right-[12vw] w-[55vw] h-[55vh] rounded-full bg-[#EAE2FF] opacity-25 blur-[100px]" />
      <div className="absolute -bottom-[20vh] left-[20vw] w-[70vw] h-[55vh] rounded-full bg-[#DCE6FF] opacity-25 blur-[100px]" />
    </div>
  );
}
