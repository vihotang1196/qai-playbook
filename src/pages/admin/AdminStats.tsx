import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, Sparkles, Send, Building2, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { ADMIN_TOOLS } from "@/lib/admin/tools";
import { getUsageStats, type AdminUsageStats } from "@/lib/adminApi";

/**
 * Cross-tool usage overview (`/admin/stats`). Reads the shared tool_usage meter
 * via the requireAdmin-gated `admin` fn. Tool-agnostic — new tools that log
 * usage appear here automatically.
 */
const toolName = (key: string) => ADMIN_TOOLS.find((t) => t.key === key)?.name.cn || key;

export default function AdminStats() {
  const [stats, setStats] = useState<AdminUsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getUsageStats()
      .then((s) => !cancelled && setStats(s))
      .catch((e) => !cancelled && toast.error(e instanceof Error ? e.message : "加载失败"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-slate-400 py-16">
        <Loader2 className="w-5 h-5 animate-spin" /> 加载中…
      </div>
    );
  }
  if (!stats) return <p className="text-sm text-slate-400 py-10">暂无数据。</p>;

  const maxTool = Math.max(1, ...stats.byTool.map((t) => t.count));
  const maxLoc = Math.max(1, ...stats.topSubAccounts.map((t) => t.count));

  return (
    <div>
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-slate-300" />
        <h1 className="text-xl font-semibold">使用统计</h1>
      </div>
      <p className="text-sm text-slate-400 mt-1">各 Sub Account 在各工具上的用量总览。</p>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3 mt-5">
        <Tile icon={<Sparkles className="w-4 h-4" />} label="总生成数" value={stats.totals.generations} />
        <Tile icon={<Send className="w-4 h-4" />} label="总发布数" value={stats.totals.posted} />
        <Tile icon={<Building2 className="w-4 h-4" />} label="活跃 Sub Account（30天）" value={stats.totals.activeSubAccounts} />
      </div>

      {/* Trend */}
      <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold mb-3">近 30 天用量趋势</h2>
        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <AreaChart data={stats.daily} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF7E5F" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#FF3D6E" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} interval={6} tick={{ fontSize: 11, fill: "#7a7f8c" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#7a7f8c" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip formatter={(v) => [String(v), "生成"]} contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)", background: "#171a22", fontSize: 12, color: "#e5e7eb" }} />
              <Area type="monotone" dataKey="count" stroke="#FF3D6E" strokeWidth={2} fill="url(#usageFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        {/* By tool */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold mb-3">按工具</h2>
          <div className="space-y-2.5">
            {ADMIN_TOOLS.map((t) => {
              const row = stats.byTool.find((b) => b.tool_key === t.key);
              const count = row?.count ?? 0;
              return (
                <div key={t.key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{t.name.cn}{!t.live && <span className="text-[11px] text-slate-500"> · 即将</span>}</span>
                    <span className="text-slate-300">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(count / maxTool) * 100}%`, background: "linear-gradient(90deg, #FF7E5F, #FF3D6E)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Top sub-accounts */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold mb-3">用量最多的 Sub Account</h2>
          {stats.topSubAccounts.length === 0 ? (
            <p className="text-sm text-slate-400">还没有用量数据。</p>
          ) : (
            <div className="space-y-2">
              {stats.topSubAccounts.map((s, i) => (
                <div key={s.location_id} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate">{s.business_name || s.location_id}</span>
                      <span className="text-slate-300 shrink-0 ml-2">{s.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-1">
                      <div className="h-full rounded-full" style={{ width: `${(s.count / maxLoc) * 100}%`, background: "linear-gradient(90deg, #FF7E5F, #FF3D6E)" }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
        <span className="text-primary">{icon}</span>
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
