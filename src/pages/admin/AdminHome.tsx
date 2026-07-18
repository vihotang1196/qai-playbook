import { Link, useOutletContext } from "react-router-dom";
import { Building2, BarChart3, ScrollText } from "lucide-react";
import type { AdminIdentity } from "@/lib/adminAuth";

/**
 * Admin Portal home (`/admin`). Step A: proves login + guard + allowlist work.
 * The cards are placeholders for the modules landing in later steps
 * (B: sub-accounts + per-tool access; D: usage stats; audit log).
 */
export default function AdminHome() {
  const admin = useOutletContext<AdminIdentity>();

  const cards = [
    { icon: <Building2 className="w-5 h-5" />, title: "Sub Account & 权限", desc: "开/关每个 Sub Account 每个工具的权限", to: "/admin/sub-accounts", soon: null },
    { icon: <ScrollText className="w-5 h-5" />, title: "审计日志", desc: "谁改了谁的权限、谁触发同步", to: "/admin/audit", soon: null },
    { icon: <BarChart3 className="w-5 h-5" />, title: "使用统计", desc: "各 Sub Account 在各工具上的用量总览", to: "/admin/stats", soon: null },
  ];

  return (
    <div>
      <h1 className="text-xl font-display font-bold">欢迎回来{admin?.name ? `，${admin.name}` : ""} 👋</h1>
      <p className="text-sm text-muted-foreground mt-1">Playbook 全平台管理后台。</p>

      <div className="grid sm:grid-cols-3 gap-4 mt-6">
        {cards.map((c) => {
          const inner = (
            <>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white mb-3" style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}>
                {c.icon}
              </div>
              <p className="font-display font-semibold">{c.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{c.desc}</p>
              {c.soon && (
                <span className="inline-block mt-3 text-[11px] rounded-full px-2 py-0.5 bg-muted text-muted-foreground">即将上线 · {c.soon}</span>
              )}
            </>
          );
          return c.to ? (
            <Link key={c.title} to={c.to} className="glass-card rounded-2xl p-5">
              {inner}
            </Link>
          ) : (
            <div key={c.title} className="glass-card rounded-2xl p-5 opacity-80">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
