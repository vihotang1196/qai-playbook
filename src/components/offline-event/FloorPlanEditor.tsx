import { useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2, Loader2, Save, LayoutGrid } from "lucide-react";
import { SeatMap } from "./SeatMap";
import { layoutToSeatGroups, type OeFloorPlanLayout, type OeFloorPlanTable, type OeDoorPos } from "@/lib/offlineEvent";
import { saveFloorPlan } from "@/lib/offlineEventAdmin";

/**
 * Visual floor-plan editor (ported from the old app, adapted to this stack).
 * Grid: click an empty cell to add a table; click a table to select + configure
 * it (label, shape 2/4/6, per-seat disable, remove). Live SeatMap preview shows
 * the customer view. Save recomputes physical_seats server-side and is BLOCKED
 * if it would remove/disable a currently-booked seat (server returns the list).
 */

interface Props {
  open: boolean;
  plan: { id: string | null; name: string; layout: OeFloorPlanLayout };
  onClose: () => void;
  onSaved: () => void;
}

function nextTableId(layout: OeFloorPlanLayout): string {
  const used = new Set(layout.tables.map((t) => t.id));
  for (let i = 1; i < 1000; i++) if (!used.has(`G${i}`)) return `G${i}`;
  return `G${layout.tables.length + 1}`;
}

function countEnabled(layout: OeFloorPlanLayout): number {
  let n = 0;
  for (const t of layout.tables) {
    const dis = new Set(t.disabledSeats ?? []);
    const miss = new Set(t.missingSeats ?? []);
    for (const s of t.seats) if (!dis.has(s) && !miss.has(s)) n++;
  }
  return n;
}

export default function FloorPlanEditor({ open, plan, onClose, onSaved }: Props) {
  const [name, setName] = useState(plan.name);
  const [layout, setLayout] = useState<OeFloorPlanLayout>(plan.layout);
  const [selId, setSelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ seat: string; event: string }[] | null>(null);

  useEffect(() => {
    if (open) {
      setName(plan.name);
      setLayout(JSON.parse(JSON.stringify(plan.layout)));
      setSelId(null);
      setErr(null);
      setBlocked(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan.id]);

  const previewGroups = useMemo(() => layoutToSeatGroups(layout, []).groups, [layout]);
  const totalSeats = useMemo(() => countEnabled(layout), [layout]);
  const selTable = layout.tables.find((t) => t.id === selId) ?? null;

  if (!open) return null;

  const patchLayout = (p: Partial<OeFloorPlanLayout>) => setLayout((l) => ({ ...l, ...p }));
  const updateTable = (id: string, patch: Partial<OeFloorPlanTable>) =>
    setLayout((l) => ({ ...l, tables: l.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const addTableAt = (col: number, row: number) =>
    setLayout((l) => {
      const id = nextTableId(l);
      return { ...l, tables: [...l.tables, { id, label: id, shape: "cluster", col, row, seats: [1, 2, 3, 4], missingSeats: [], disabledSeats: [] }] };
    });
  const removeTable = (id: string) => {
    setLayout((l) => ({ ...l, tables: l.tables.filter((t) => t.id !== id) }));
    setSelId(null);
  };
  const setShape = (id: string, n: 2 | 4 | 6) => {
    const shape = n === 6 ? "long" : "cluster";
    updateTable(id, {
      shape,
      seats: Array.from({ length: n }, (_, i) => i + 1),
      disabledSeats: (selTable?.disabledSeats ?? []).filter((s) => s <= n),
      missingSeats: (selTable?.missingSeats ?? []).filter((s) => s <= n),
    });
  };
  const toggleSeatDisabled = (id: string, seat: number) => {
    const t = layout.tables.find((x) => x.id === id);
    if (!t) return;
    const has = (t.disabledSeats ?? []).includes(seat);
    updateTable(id, { disabledSeats: has ? t.disabledSeats.filter((s) => s !== seat) : [...(t.disabledSeats ?? []), seat] });
  };

  const tableByCell = (col: number, row: number) => layout.tables.find((t) => t.col === col && t.row === row);

  const save = async () => {
    if (!name.trim()) { setErr("请填名称"); return; }
    setSaving(true); setErr(null); setBlocked(null);
    try {
      await saveFloorPlan(plan.id, name.trim(), layout);
      onSaved();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      const detail = (e as { detail?: { missing?: { seat: string; event: string }[] } })?.detail;
      if (msg === "booked_seats_removed") {
        setErr("有已被订走的座位会被删掉/禁用,已拦下。请保留下列座位:");
        setBlocked(Array.isArray(detail?.missing) ? detail!.missing! : null);
      } else {
        setErr(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-5xl rounded-3xl bg-background shadow-2xl max-h-[94vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0 bg-background z-10 border-b border-border/40">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-primary" />
            <p className="font-display font-bold">{plan.id ? "编辑平面图" : "新建平面图"}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Controls */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">名称</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inp} maxLength={80} />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">列数</label>
              <input type="number" min={1} max={12} value={layout.columns} onChange={(e) => patchLayout({ columns: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })} className={inp} />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">行数</label>
              <input type="number" min={1} max={12} value={layout.rows} onChange={(e) => patchLayout({ rows: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })} className={inp} />
            </div>
          </div>
          {/* Venue elements: stage / door position / divider */}
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-3 space-y-2 text-sm">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={layout.stage} onChange={(e) => patchLayout({ stage: e.target.checked })} /> 舞台</label>
              {layout.stage && (
                <select value={layout.stagePosition ?? "top"} onChange={(e) => patchLayout({ stagePosition: e.target.value as "top" | "bottom" })} className="h-8 rounded-lg border border-border bg-background px-2 text-xs">
                  <option value="top">顶部</option>
                  <option value="bottom">底部</option>
                </select>
              )}
              <span className="ml-2 text-muted-foreground">门:</span>
              <select value={layout.door} onChange={(e) => patchLayout({ door: e.target.value as OeDoorPos })} className="h-8 rounded-lg border border-border bg-background px-2 text-xs">
                <option value="none">无</option>
                <option value="bottom-right">右下</option>
                <option value="bottom-center">中下</option>
                <option value="bottom-left">左下</option>
                <option value="top">顶部</option>
              </select>
              <span className="ml-auto text-xs text-muted-foreground font-semibold">{layout.tables.length} 桌 · {totalSeats} 座</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={!!layout.divider?.enabled}
                  onChange={(e) => patchLayout({ divider: { enabled: e.target.checked, axis: layout.divider?.axis ?? "vertical", pos: layout.divider?.pos ?? 50 } })}
                /> 虚线边界
              </label>
              {layout.divider?.enabled && (
                <>
                  <select value={layout.divider.axis} onChange={(e) => patchLayout({ divider: { ...layout.divider!, axis: e.target.value as "vertical" | "horizontal" } })} className="h-8 rounded-lg border border-border bg-background px-2 text-xs">
                    <option value="vertical">竖线</option>
                    <option value="horizontal">横线</option>
                  </select>
                  <input type="range" min={0} max={100} value={layout.divider.pos} onChange={(e) => patchLayout({ divider: { ...layout.divider!, pos: Number(e.target.value) } })} className="flex-1 min-w-[120px]" />
                  <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{layout.divider.pos}%</span>
                </>
              )}
            </div>
          </div>

          {/* Grid */}
          <div>
            <p className="text-[11px] text-muted-foreground mb-1">点空格加桌子,点桌子配置</p>
            <div className="rounded-2xl border border-border bg-muted/30 p-3 overflow-auto">
              {layout.stage && <div className="h-7 mb-2 rounded-lg bg-pink-100 text-pink-800 text-[11px] font-semibold flex items-center justify-center tracking-wider">舞台 STAGE</div>}
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(28px, 1fr))` }}>
                {Array.from({ length: layout.rows * layout.columns }, (_, i) => {
                  const col = (i % layout.columns) + 1;
                  const row = Math.floor(i / layout.columns);
                  const t = tableByCell(col, row);
                  if (t) {
                    const sel = t.id === selId;
                    return (
                      <button
                        key={`${col}-${row}`}
                        onClick={() => setSelId(sel ? null : t.id)}
                        className={`aspect-[3/4] rounded-lg border-2 flex flex-col items-center justify-center text-[10px] font-bold transition-colors ${sel ? "border-primary ring-2 ring-primary/30" : "border-pink-400"} text-pink-900`}
                        style={{ background: "linear-gradient(to bottom, #ffe4ec, #ffe9dd)" }}
                        title={`${t.label} · ${t.seats.length}座`}
                      >
                        <span>{t.label}</span>
                        <span className="text-[9px] font-normal opacity-70">{t.seats.length}s</span>
                      </button>
                    );
                  }
                  return (
                    <button key={`${col}-${row}`} onClick={() => addTableAt(col, row)} className="aspect-[3/4] rounded-lg border border-dashed border-border bg-background/50 hover:bg-muted text-muted-foreground flex items-center justify-center" title={`加桌子 (${col},${row + 1})`}>
                      <Plus className="w-3 h-3" />
                    </button>
                  );
                })}
              </div>
              {layout.door !== "none" && <div className="mt-2 flex justify-end"><span className="text-[10px] px-2 py-0.5 rounded bg-pink-100 text-pink-800 font-semibold">门 DOOR</span></div>}
            </div>
          </div>

          {/* Selected table config */}
          {selTable && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">配置桌子 {selTable.id}</p>
                <button onClick={() => setSelId(null)} className="text-xs text-muted-foreground hover:text-foreground">完成</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">标签</label>
                  <input value={selTable.label} onChange={(e) => updateTable(selTable.id, { label: e.target.value.slice(0, 20) })} className={inp} />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">座位数</label>
                  <div className="mt-1 flex gap-1.5">
                    {([2, 4, 6] as const).map((n) => {
                      const active = selTable.seats.length === n && (selTable.shape ?? "cluster") === (n === 6 ? "long" : "cluster");
                      return (
                        <button key={n} onClick={() => setShape(selTable.id, n)} className={`h-9 flex-1 rounded-lg text-sm font-medium ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {n === 6 ? "6(长)" : n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">座位（点一下禁用/启用）</label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {selTable.seats.map((n) => {
                    const missing = (selTable.missingSeats ?? []).includes(n);
                    const disabled = (selTable.disabledSeats ?? []).includes(n);
                    if (missing) return <span key={n} className="h-8 w-8 rounded-lg bg-muted text-muted-foreground/50 text-xs flex items-center justify-center" title="此座缺失">缺</span>;
                    return (
                      <button key={n} onClick={() => toggleSeatDisabled(selTable.id, n)} className={`h-8 w-8 rounded-lg text-xs font-semibold flex items-center justify-center ${disabled ? "bg-gray-300 text-gray-500 line-through" : "bg-emerald-100 text-emerald-700"}`} title={disabled ? "已禁用,点击启用" : "已启用,点击禁用"}>
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button onClick={() => removeTable(selTable.id)} className="h-9 px-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> 删除此桌</button>
            </div>
          )}

          {/* Live preview */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">实时预览（顾客所见）</p>
            <div className="overflow-auto rounded-2xl">
              <SeatMap seatGroups={previewGroups} selectedSeatIds={[]} selectedGroupId={null} onToggleSeat={() => {}} warning={null} maxSelectable={0} columns={layout.columns} rows={layout.rows} door={layout.door} stage={layout.stage} stagePosition={layout.stagePosition} divider={layout.divider} />
            </div>
          </div>

          {err && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {err}
              {blocked && <ul className="mt-1 list-disc pl-5 text-xs">{blocked.map((b, i) => <li key={i}>{b.seat}（{b.event}）</li>)}</ul>}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-border/40">
            <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-muted text-sm font-medium">取消</button>
            <button onClick={save} disabled={saving} className="flex-1 h-11 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40" style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inp = "mt-1 w-full h-10 rounded-xl border border-border bg-background px-3 text-sm";
