import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, BookOpen, Bot, MessagesSquare, BarChart3, Megaphone, Settings } from "lucide-react";

const TABS = [
  { to: "/admin/helpdesk", label: "总览", icon: LayoutDashboard, end: true },
  { to: "/admin/helpdesk/knowledge", label: "知识库", icon: BookOpen },
  { to: "/admin/helpdesk/chat", label: "AI 测试", icon: Bot },
  { to: "/admin/helpdesk/conversations", label: "对话", icon: MessagesSquare },
  { to: "/admin/helpdesk/analytics", label: "分析", icon: BarChart3 },
  { to: "/admin/helpdesk/updates", label: "更新", icon: Megaphone },
  { to: "/admin/helpdesk/settings", label: "设置", icon: Settings },
];

/**
 * Helpdesk section shell, nested INSIDE the Admin Portal's AdminLayout — so it
 * reuses the ONE real login + requireAdmin guard + coral-glass chrome instead of
 * standing up a second login. Renders the Helpdesk sub-tab nav and the active
 * section via <Outlet/>.
 *
 * Rationale: the Helpdesk is the agency's SHARED help center, edited only by
 * signed-in platform admins (no per-customer view), so its admin naturally lives
 * in the platform back office — unlike Review Boost, whose per-sub-account admin
 * lives in the customer route space under URL identity.
 */
export default function HelpdeskAdminShell() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-display font-bold">帮助中心 Helpdesk</h1>
        <p className="text-sm text-muted-foreground mt-1">
          QAI 全平台共享的 AI 客服知识库与挂件。
        </p>
      </div>

      <nav className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground border border-border/50"
              }`
            }
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
