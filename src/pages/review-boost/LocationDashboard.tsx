import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, QrCode, Send, TrendingUp, Info, Megaphone, Plus } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageContext";
import { RB_PLATFORMS } from "@/lib/review-boost/platforms";
import { getStats, type RBStats } from "@/lib/reviewBoost";

/**
 * Location dashboard (`/review-boost/location/:locationId[/dashboard]`) — the
 * sub-account's own results: total scans, posted, posted-rate, a 30-day trend,
 * and a per-campaign comparison. Scoped to this location via the `rb` fn.
 */
const platformLabel = (id: string, lang: "cn" | "en") =>
  RB_PLATFORMS.find((p) => p.id === id)?.label[lang] ?? id;

export default function LocationDashboard() {
  const { locationId } = useParams();
  const { lang } = useLang();
  const label = (cn: string, en: string) => (lang === "cn" ? cn : en);

  const [stats, setStats] = useState<RBStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!locationId) return;
      setLoading(true);
      try {
        const s = await getStats(locationId);
        if (!cancelled) setStats(s);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load stats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const scans = stats?.totals.scans ?? 0;
  const posted = stats?.totals.posted ?? 0;
  const rate = scans > 0 ? Math.round((posted / scans) * 100) : null;
  const campaignsUrl = `/review-boost/location/${locationId}/campaigns`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold">{label("数据面板", "Dashboard")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {label("这个子账号所有活动的扫码与好评效果。", "Scans and reviews across all your campaigns.")}
        </p>
      </div>

      {loading ? (
        <div className="glass-card rounded-2xl px-5 py-10 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> {label("加载中…", "Loading…")}
        </div>
      ) : !stats || stats.perCampaign.length === 0 ? (
        <div className="glass-card rounded-2xl px-5 py-12 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white" style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}>
            <Megaphone className="w-6 h-6" />
          </div>
          <p className="font-display font-semibold">{label("还没有数据", "No data yet")}</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            {label("建个活动、贴上二维码，顾客扫码后这里就会有扫码数和发布率。", "Create a campaign and put up its QR — scans and posted-rate will show up here once customers scan.")}
          </p>
          <Link
            to={`${campaignsUrl}/new`}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white mt-1"
            style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
          >
            <Plus className="w-4 h-4" /> {label("新建活动", "New campaign")}
          </Link>
        </div>
      ) : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-3 gap-3">
            <Tile icon={<QrCode className="w-4 h-4" />} label={label("扫码次数", "Scans")} value={String(scans)} />
            <Tile icon={<Send className="w-4 h-4" />} label={label("已发布", "Posted")} value={String(posted)} />
            <Tile icon={<TrendingUp className="w-4 h-4" />} label={label("发布率", "Posted rate")} value={rate === null ? "—" : `${rate}%`} />
          </div>
          <div className="flex items-start gap-2 -mt-2">
            <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              {label(
                "发布率为顾客自报（扫码后点了「我发了」才算），不是平台核实的精确数据，仅作参考。",
                "Posted rate is customer-reported (they tapped “I posted it”) — not verified by the platform, so treat it as a guide.",
              )}
            </p>
          </div>

          {/* 30-day trend */}
          <section className="glass-card rounded-2xl p-5">
            <h2 className="font-display font-semibold mb-3">{label("近 30 天扫码趋势", "Scans — last 30 days")}</h2>
            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer>
                <AreaChart data={stats.daily} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scanFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF7E5F" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#FF3D6E" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => d.slice(5)}
                    interval={6}
                    tick={{ fontSize: 11, fill: "#9a9ab0" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9a9ab0" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    labelFormatter={(d) => String(d)}
                    formatter={(v) => [String(v), label("扫码", "scans")]}
                    contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="scans" stroke="#FF3D6E" strokeWidth={2} fill="url(#scanFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Per-campaign comparison */}
          <section className="glass-card rounded-2xl p-5">
            <h2 className="font-display font-semibold mb-3">{label("各活动对比", "By campaign")}</h2>
            <PerCampaign stats={stats} lang={lang} locationId={locationId!} label={label} />
          </section>
        </>
      )}
    </div>
  );
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
        <span className="text-primary">{icon}</span>
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-display font-bold">{value}</p>
    </div>
  );
}

function PerCampaign({
  stats,
  lang,
  locationId,
  label,
}: {
  stats: RBStats;
  lang: "cn" | "en";
  locationId: string;
  label: (cn: string, en: string) => string;
}) {
  const rows = [...stats.perCampaign].sort((a, b) => b.scans - a.scans);
  const max = Math.max(1, ...rows.map((r) => r.scans));
  return (
    <div className="space-y-2.5">
      {rows.map((c) => {
        const rate = c.scans > 0 ? Math.round((c.posted / c.scans) * 100) : null;
        return (
          <Link
            key={c.id}
            to={`/review-boost/location/${locationId}/campaigns/${c.id}`}
            className="block rounded-xl border border-border/50 p-3 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <span className="font-medium text-sm truncate">{c.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {platformLabel(c.platform, lang)}
              </span>
            </div>
            {/* scans bar */}
            <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(c.scans / max) * 100}%`, background: "linear-gradient(90deg, #FF7E5F, #FF3D6E)" }}
              />
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
              <span>{label("扫码", "Scans")} <b className="text-foreground">{c.scans}</b></span>
              <span>{label("发布", "Posted")} <b className="text-foreground">{c.posted}</b></span>
              <span>{label("发布率", "Rate")} <b className="text-foreground">{rate === null ? "—" : `${rate}%`}</b></span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
