import { useEffect, useState } from "react";
import {
  CalendarDays,
  LayoutGrid,
  Ticket,
  CheckCircle2,
  Clock,
  Banknote,
  Armchair,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { getOverview, type OfflineEventOverview } from "@/lib/offlineEventAdmin";

/**
 * Offline Event admin landing (`/admin/offline-event`). P2: proves the
 * authenticated data path — pulls LIVE counts from the oe_ tables through the
 * requireAdmin-gated `offline-event-admin` edge fn (the frontend never touches
 * the RLS-locked tables directly). Also a visible confirmation the P1 seed
 * landed: it should show 3 events (3 live) + 1 floor plan, 0 bookings.
 */
export default function OfflineEventOverview() {
  const [data, setData] = useState<OfflineEventOverview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getOverview()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="glass-card rounded-2xl p-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-sm">加载总览失败</p>
          <p className="text-sm text-muted-foreground mt-0.5">{err ?? "无数据"}</p>
        </div>
      </div>
    );
  }

  const c = data.counts;
  const rm = `RM ${data.revenue.toFixed(2)}`;
  const tiles: { icon: typeof CalendarDays; label: string; value: string | number; sub?: string }[] = [
    { icon: CalendarDays, label: "活动", value: c.eventsTotal, sub: `${c.eventsLive} 场进行中` },
    { icon: LayoutGrid, label: "平面图", value: c.floorPlans },
    { icon: Ticket, label: "报名", value: c.bookingsTotal },
    { icon: CheckCircle2, label: "已确认", value: c.bookingsConfirmed },
    { icon: Clock, label: "待付款", value: c.bookingsPending },
    { icon: Armchair, label: "已占座位", value: c.seatsClaimed },
    { icon: Banknote, label: "收入 (已确认)", value: rm },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="glass-card rounded-2xl p-4">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#fed50a] mb-3"
              style={{ background: "#141414" }}
            >
              <t.icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-display font-bold tabular-nums break-all">{t.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t.label}</p>
            {t.sub && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{t.sub}</p>}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        数据实时来自线下活动数据库（经管理员鉴权的后端读取，前端不直连数据表）。报名为 0 是正常的——
        客户报名流程从 P3 / P4 起接入；活动与平面图的数字来自 P1 的种子数据。
      </p>
    </div>
  );
}
