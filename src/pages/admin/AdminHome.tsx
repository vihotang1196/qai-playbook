import { useOutletContext } from "react-router-dom";
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
    { icon: <Building2 className="w-5 h-5" />, title: "子账号 & 权限", desc: "开/关每个子账号每个工具的权限", soon: "步骤 B" },
    { icon: <BarChart3 className="w-5 h-5" />, title: "使用统计", desc: "各子账号在各工具上的用量总览", soon: "步骤 D" },
    { icon: <ScrollText className="w-5 h-5" />, title: "审计日志", desc: "谁改了谁的权限", soon: "步骤 B" },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold">欢迎回来{admin?.name ? `，${admin.name}` : ""} 👋</h1>
      <p className="text-sm text-slate-400 mt-1">Playbook 全平台管理后台。以下模块将逐步上线。</p>

      <div className="grid sm:grid-cols-3 gap-4 mt-6">
        {cards.map((c) => (
          <div key={c.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white mb-3" style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}>
              {c.icon}
            </div>
            <p className="font-semibold">{c.title}</p>
            <p className="text-sm text-slate-400 mt-1">{c.desc}</p>
            <span className="inline-block mt-3 text-[11px] rounded-full px-2 py-0.5 bg-white/10 text-slate-300">即将上线 · {c.soon}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300/90">
        ✓ 登录、路由守卫、管理员白名单已就位。你能看到这个页面，说明这三样都在正常工作。
      </div>
    </div>
  );
}
