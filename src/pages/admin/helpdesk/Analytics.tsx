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
import { Loader2, MessageSquare, HelpCircle, Sparkles, Users, ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { getSupportAnalytics, type SupportAnalytics } from "@/lib/helpdeskAdmin";

/**
 * Helpdesk analytics (`/admin/helpdesk/analytics`). Reads the requireAdmin-gated
 * `getSupportAnalytics` action. EXCLUDES the internal admin-test channel so the
 * numbers reflect real (web / widget) usage only. Standard dashboard: tiles +
 * AI-answered rate + 👍/👎 + 30-day trend + channel breakdown + per-Sub-Account
 * attribution + top questions.
 */
const CHANNEL_LABEL: Record<string, string> = { web: "网页", widget: "帮助中心", "admin-test": "内部测试" };

export default function HelpdeskAnalytics() {
  const [a, setA] = useState<SupportAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSupportAnalytics()
      .then((s) => !cancelled && setA(s))
      .catch((e) => !cancelled && toast.error(e instanceof Error ? e.message : "加载失败"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-muted-foreground py-16">
        <Loader2 className="w-5 h-5 animate-spin" /> 加载中…
      </div>
    );
  }
  if (!a) return <p className="text-sm text-muted-foreground py-10">暂无数据。</p>;

  const rate = Math.round(a.totals.aiAnsweredRate * 100);
  const maxChannel = Math.max(1, ...a.byChannel.map((c) => c.count));
  const maxLoc = Math.max(1, ...a.topLocations.map((l) => l.count));
  const maxQ = Math.max(1, ...a.topQuestions.map((q) => q.count));
  const totalFeedback = a.totals.feedbackUp + a.totals.feedbackDown;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">访客与 Angel AI 的使用情况（不含内部「AI 测试」）。</p>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile icon={<MessageSquare className="w-4 h-4" />} label="对话数" value={a.totals.conversations} />
        <Tile icon={<HelpCircle className="w-4 h-4" />} label="提问数" value={a.totals.questions} />
        <Tile icon={<Sparkles className="w-4 h-4" />} label="AI 答题率" value={`${rate}%`} />
        <Tile icon={<Users className="w-4 h-4" />} label="访客数" value={a.totals.visitors} />
      </div>

      {/* Feedback */}
      <section className="glass-card rounded-2xl p-5">
        <h2 className="font-semibold mb-3">用户反馈</h2>
        {totalFeedback === 0 ? (
          <p className="text-sm text-muted-foreground">暂无反馈数据——访客在帮助中心给 AI 回答点 👍/👎 后会显示在这里。</p>
        ) : (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <ThumbsUp className="w-5 h-5 text-foreground" />
              <span className="text-2xl font-semibold">{a.totals.feedbackUp}</span>
            </div>
            <div className="flex items-center gap-2">
              <ThumbsDown className="w-5 h-5 text-muted-foreground" />
              <span className="text-2xl font-semibold">{a.totals.feedbackDown}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              好评率 {Math.round((a.totals.feedbackUp / totalFeedback) * 100)}%
            </div>
          </div>
        )}
      </section>

      {/* Trend */}
      <section className="glass-card rounded-2xl p-5">
        <h2 className="font-semibold mb-3">近 30 天提问趋势</h2>
        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <AreaChart data={a.trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="hdFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fed50a" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#fed50a" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} interval={6} tick={{ fontSize: 11, fill: "#9a9ab0" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9a9ab0" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip formatter={(v) => [String(v), "提问"]} contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", background: "#ffffff", fontSize: 12 }} />
              <Area type="monotone" dataKey="count" stroke="#141414" strokeWidth={2} fill="url(#hdFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-4">
        {/* By channel */}
        <section className="glass-card rounded-2xl p-5">
          <h2 className="font-semibold mb-3">按渠道</h2>
          {a.byChannel.length === 0 ? (
            <p className="text-sm text-muted-foreground">还没有数据。</p>
          ) : (
            <div className="space-y-2.5">
              {a.byChannel.map((c) => (
                <div key={c.channel}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{CHANNEL_LABEL[c.channel] || c.channel}</span>
                    <span className="text-foreground">{c.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(c.count / maxChannel) * 100}%`, background: "#fed50a" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Top sub-accounts */}
        <section className="glass-card rounded-2xl p-5">
          <h2 className="font-semibold mb-3">用得最多的 Sub Account</h2>
          {a.topLocations.length === 0 ? (
            <p className="text-sm text-muted-foreground">还没有归因数据。</p>
          ) : (
            <div className="space-y-2">
              {a.topLocations.map((s, i) => (
                <div key={s.location_id} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate">{s.business_name || s.location_id}</span>
                      <span className="text-foreground shrink-0 ml-2">{s.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
                      <div className="h-full rounded-full" style={{ width: `${(s.count / maxLoc) * 100}%`, background: "#fed50a" }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Top questions */}
      <section className="glass-card rounded-2xl p-5">
        <h2 className="font-semibold mb-3">热门问题</h2>
        {a.topQuestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">还没有提问。</p>
        ) : (
          <div className="space-y-2">
            {a.topQuestions.map((q, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                <span className="text-sm flex-1 min-w-0 truncate" title={q.question}>{q.question}</span>
                {q.count > 1 && <span className="text-xs text-muted-foreground shrink-0">×{q.count}</span>}
                <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                  <div className="h-full rounded-full" style={{ width: `${(q.count / maxQ) * 100}%`, background: "#fed50a" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
        <span className="text-foreground">{icon}</span>
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
