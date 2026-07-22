/**
 * Offline Event admin — placeholder sections.
 *
 * Real pages so far: Overview (P2), CheckIn (P6), Bookings (P7a), EventDates
 * (P7b). The rest become real pages in later phases:
 *   - FloorPlans → P8 (visual drag-drop floor-plan editor)
 *   - Settings   → P7c (Stripe mode, SST, lunch price, per-subaccount free allowance)
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

export function OEFloorPlans(): ReactNode {
  return <Placeholder title="平面图" desc="可视化拖拽编辑会场座位布局（含禁用座位）。" phase="P8" />;
}
export function OESettings(): ReactNode {
  return <Placeholder title="设置" desc="Stripe 测试/正式模式、SST 税率、午餐价、每子账号免费额度。" phase="P7" />;
}
