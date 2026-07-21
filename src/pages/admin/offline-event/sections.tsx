/**
 * Offline Event admin — placeholder sections (P0 scaffold).
 *
 * Each becomes a real page in a later phase:
 *   - Overview   → P2 (live counts via the offline-event-admin fn)
 *   - Bookings   → P7 (list/search/change/archive)
 *   - EventDates → P7 (CRUD event dates + per-event price)
 *   - FloorPlans → P8 (visual drag-drop floor-plan editor)
 *   - CheckIn    → P6 (QR scanner → mark day1/day2 attendance)
 *   - Settings   → P7 (Stripe mode, SST, lunch price, per-subaccount free allowance)
 */
import type { ReactNode } from "react";

function Placeholder({ title, desc, phase }: { title: string; desc: string; phase: string }) {
  return (
    <div className="glass-card rounded-2xl px-6 py-10 flex flex-col items-center text-center gap-2">
      <p className="font-display font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground max-w-md">{desc}</p>
      <span className="inline-block mt-2 text-[11px] rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
        即将上线 · {phase}
      </span>
    </div>
  );
}

export function OEOverview(): ReactNode {
  return <Placeholder title="总览" desc="活动数、报名数、收入、平面图数的实时统计。" phase="P2" />;
}
export function OEBookings(): ReactNode {
  return <Placeholder title="报名管理" desc="查看/搜索报名、改期、改座位、归档。" phase="P7" />;
}
export function OEEventDates(): ReactNode {
  return <Placeholder title="活动日期" desc="新建/编辑活动日期，每场可单独设票价。" phase="P7" />;
}
export function OEFloorPlans(): ReactNode {
  return <Placeholder title="平面图" desc="可视化拖拽编辑会场座位布局（含禁用座位）。" phase="P8" />;
}
export function OECheckIn(): ReactNode {
  return <Placeholder title="签到" desc="摄像头扫二维码，标记 day1 / day2 到场。" phase="P6" />;
}
export function OESettings(): ReactNode {
  return <Placeholder title="设置" desc="Stripe 测试/正式模式、SST 税率、午餐价、每子账号免费额度。" phase="P7" />;
}
