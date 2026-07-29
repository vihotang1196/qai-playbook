import { useEffect, useState } from "react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Loader2, AlertCircle, Plus, Pencil, Trash2, Copy, Star, LayoutGrid } from "lucide-react";
import {
  listFloorPlans,
  deleteFloorPlan,
  setDefaultFloorPlan,
  duplicateFloorPlan,
  type OeAdminFloorPlan,
} from "@/lib/offlineEventAdmin";
import type { OeFloorPlanLayout } from "@/lib/offlineEvent";
import FloorPlanEditor from "@/components/offline-event/FloorPlanEditor";

/**
 * Offline Event admin — P8 floor plans (`/admin/offline-event/floor-plans`).
 * List / create / duplicate / edit / set-default / delete seat layouts. The
 * visual editor is FloorPlanEditor. Delete is blocked for the default plan or
 * one used by events; the editor blocks removing a currently-booked seat.
 * (Linking a plan to an event is done in the P7b event editor.)
 */

function blankLayout(): OeFloorPlanLayout {
  return { columns: 6, rows: 5, stage: true, stagePosition: "top", door: "bottom", doorPos: 85, tables: [] };
}

export default function OfflineEventFloorPlans() {
  const [plans, setPlans] = useState<OeAdminFloorPlan[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // usedBy / bookedLabels ride along so the editor can warn that a shared plan
  // changes every event at once, and so bulk shrink can spare sold seats.
  const [editing, setEditing] = useState<{ id: string | null; name: string; layout: OeFloorPlanLayout; usedBy: string[]; bookedLabels: string[] } | null>(null);

  const load = () => {
    setErr(null);
    listFloorPlans().then(setPlans).catch((e) => setErr(e instanceof Error ? e.message : "加载失败"));
  };
  useEffect(load, []);

  // In-app dialogs, never window.confirm/prompt/alert — a suppressed native
  // dialog returns false/null and the action would abort SILENTLY.
  const [confirmDel, setConfirmDel] = useState<OeAdminFloorPlan | null>(null);
  const [dupTarget, setDupTarget] = useState<OeAdminFloorPlan | null>(null);

  const del = async (p: OeAdminFloorPlan) => {
    setBusy(true);
    try {
      await deleteFloorPlan(p.id);
      setConfirmDel(null);
      toast.success(`已删除平面图「${p.name}」`);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "删除失败";
      setConfirmDel(null);
      // Server-side guards must be SHOWN, not swallowed by a blocked alert().
      toast.error(
        msg === "is_default"
          ? "默认平面图不能删，请先把别的设为默认。"
          : msg === "in_use"
            ? "该平面图正被活动使用，不能删。请先在活动里改用别的平面图。"
            : msg,
        { duration: 8000 },
      );
    } finally {
      setBusy(false);
    }
  };

  const dup = async (p: OeAdminFloorPlan, name: string) => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await duplicateFloorPlan(p.id, name.trim());
      setDupTarget(null);
      toast.success(`已复制为「${name.trim()}」`);
      load();
    } catch (e) {
      setDupTarget(null);
      toast.error(e instanceof Error ? e.message : "复制失败");
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async (p: OeAdminFloorPlan) => {
    setBusy(true);
    try {
      await setDefaultFloorPlan(p.id);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "设置失败");
    } finally {
      setBusy(false);
    }
  };

  if (err && !plans) {
    return (
      <div className="glass-card rounded-2xl p-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div><p className="font-medium text-sm">加载失败</p><p className="text-sm text-muted-foreground mt-0.5">{err}</p></div>
      </div>
    );
  }
  if (!plans) {
    return <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">共 {plans.length} 个平面图</p>
        <button onClick={() => setEditing({ id: null, name: "", layout: blankLayout(), usedBy: [], bookedLabels: [] })} className="h-9 px-4 rounded-xl text-[#141414] text-sm font-medium flex items-center gap-1.5" style={{ background: "#fed50a" }}>
          <Plus className="w-4 h-4" /> 新建平面图
        </button>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}

      <div className="grid grid-cols-1 gap-3">
        {plans.map((p) => (
          <div key={p.id} className="glass-card rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[#fed50a] shrink-0" style={{ background: "#141414" }}>
                <LayoutGrid className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{p.name}</p>
                  {p.is_default && <span className="rounded-full px-2 py-0.5 text-[11px] bg-white text-[#141414] border border-[#141414]/40 flex items-center gap-1"><Star className="w-3 h-3" /> 默认</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(p.layout_data?.tables?.length ?? 0)} 桌 · {p.physical_seats} 座
                  {p.used_by_count > 0 ? ` · ${p.used_by_count} 个活动使用` : " · 未被活动使用"}
                  {p.booked_seats > 0 ? ` · 已订 ${p.booked_seats} 座` : ""}
                </p>
                {p.used_by.length > 0 && <p className="text-[11px] text-muted-foreground/80 mt-0.5 truncate">用于:{p.used_by.join("、")}</p>}
              </div>
              <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                <button onClick={() => setEditing({ id: p.id, name: p.name, layout: p.layout_data, usedBy: p.used_by ?? [], bookedLabels: p.booked_labels ?? [] })} className="h-9 px-3 rounded-lg bg-muted text-xs font-medium flex items-center gap-1 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /> 编辑</button>
                <button onClick={() => setDupTarget(p)} disabled={busy} className="h-9 px-3 rounded-lg bg-muted text-xs font-medium flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-50"><Copy className="w-3.5 h-3.5" /> 复制</button>
                {!p.is_default && <button onClick={() => makeDefault(p)} disabled={busy} className="h-9 px-3 rounded-lg bg-muted text-xs font-medium flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-50"><Star className="w-3.5 h-3.5" /> 设默认</button>}
                <button onClick={() => setConfirmDel(p)} disabled={busy || p.is_default || p.used_by_count > 0} className="h-9 w-9 rounded-lg bg-[#141414]/[0.06] text-[#141414] flex items-center justify-center hover:bg-[#141414]/[0.12] disabled:opacity-30" title={p.is_default ? "默认不能删" : p.used_by_count > 0 ? "被活动使用中" : "删除"}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <FloorPlanEditor
          open
          plan={editing}
          usedBy={editing.usedBy}
          bookedLabels={editing.bookedLabels}
          onRequestDuplicate={() => {
            // Close the editor first: any unsaved edits here would apply to the
            // ORIGINAL plan, which is exactly what the warning is telling them
            // not to do. The copy then gets edited on its own.
            const target = plans?.find((x) => x.id === editing.id) ?? null;
            setEditing(null);
            if (target) setDupTarget(target);
          }}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}

      <ConfirmDialog
        open={!!confirmDel}
        danger
        busy={busy}
        title="删除这个平面图？"
        description={
          <>
            「<b className="text-[#141414]">{confirmDel?.name}</b>」将被永久删除，无法撤销。
          </>
        }
        confirmLabel="永久删除"
        cancelLabel="返回"
        onConfirm={() => confirmDel && del(confirmDel)}
        onCancel={() => setConfirmDel(null)}
      />

      <ConfirmDialog
        open={!!dupTarget}
        busy={busy}
        title="复制平面图"
        description="新平面图会复制原来的所有桌位布局，之后可以单独编辑。"
        inputLabel="新平面图名称"
        inputDefaultValue={dupTarget ? `${dupTarget.name} (副本)` : ""}
        confirmLabel="复制"
        onConfirm={(name) => dupTarget && dup(dupTarget, name)}
        onCancel={() => setDupTarget(null)}
      />
    </div>
  );
}
