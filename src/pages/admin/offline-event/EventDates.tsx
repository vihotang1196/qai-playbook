import { useEffect, useState } from "react";
import { Loader2, AlertCircle, Plus, Pencil, Trash2, X, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import {
  listEventsAdmin,
  createEvent,
  updateEvent,
  deleteEvent,
  type OeAdminEvent,
  type OeFloorPlanOption,
  type OeEventInput,
  type OeEventStatus,
} from "@/lib/offlineEventAdmin";

/**
 * Offline Event admin — P7b event-date management (`/admin/offline-event/event-dates`).
 * Create / edit / delete events (dates, themes, notices, price, capacity, floor
 * plan, status, order). Guards (server-side): can't delete an event with active
 * bookings (close it instead), can't set capacity below claimed seats, can't
 * change the floor plan once seats are claimed.
 */

const STATUS_META: Record<OeEventStatus, { label: string; cls: string }> = {
  live: { label: "开放 live", cls: "bg-[#fed50a] text-[#141414]" },
  display: { label: "只展示 display", cls: "bg-[#141414]/[0.06] text-[#141414] border border-[#141414]/20" },
  off: { label: "关闭 off", cls: "bg-gray-200 text-gray-600" },
};

const ERR_ZH: Record<string, string> = {
  label_required: "请填活动名称。",
  dates_required: "请填开始和结束日期。",
  end_before_start: "结束日期不能早于开始日期。",
};

function emptyForm(defaultPlanId: string): OeEventInput {
  return {
    display_label: "", start_date: "", end_date: "", time_slot: "10:00 AM - 6:00 PM",
    theme_zh: "", theme_en: "", notice_zh: "", notice_en: "",
    price_per_seat: "", capacity: "", floor_plan_id: defaultPlanId || null,
    seat_selection_enabled: true, status: "live", sort_order: "",
  };
}

function toForm(e: OeAdminEvent): OeEventInput {
  return {
    display_label: e.display_label, start_date: e.start_date, end_date: e.end_date, time_slot: e.time_slot,
    theme_zh: e.theme_zh ?? "", theme_en: e.theme_en ?? "", notice_zh: e.notice_zh ?? "", notice_en: e.notice_en ?? "",
    price_per_seat: e.price_per_seat, capacity: e.capacity ?? "", floor_plan_id: e.floor_plan_id,
    seat_selection_enabled: e.seat_selection_enabled, status: e.status, sort_order: e.sort_order,
  };
}

export default function OfflineEventEventDates() {
  const [events, setEvents] = useState<OeAdminEvent[] | null>(null);
  const [plans, setPlans] = useState<OeFloorPlanOption[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null); // null = create
  const [form, setForm] = useState<OeEventInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = () => {
    setErr(null);
    listEventsAdmin()
      .then((r) => { setEvents(r.events); setPlans(r.floorPlans); })
      .catch((e) => setErr(e instanceof Error ? e.message : "加载失败"));
  };
  useEffect(load, []);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm(plans[0]?.id ?? ""));
    setFormErr(null);
    setFormOpen(true);
  };
  const openEdit = (e: OeAdminEvent) => {
    setEditId(e.id);
    setForm(toForm(e));
    setFormErr(null);
    setFormOpen(true);
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setFormErr(null);
    try {
      if (editId) await updateEvent(editId, form);
      else await createEvent(form);
      setFormOpen(false);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      setFormErr(
        ERR_ZH[msg] ||
        (msg.startsWith("capacity_below_claimed") || msg === "capacity_below_claimed" ? "容量不能低于已占座位数。" :
         msg === "cannot_change_plan_with_bookings" ? "该活动已有占座，不能换平面图。" : msg),
      );
    } finally {
      setSaving(false);
    }
  };

  // Delete confirmation lives in the app's own dialog, NOT window.confirm().
  // A native confirm() returns false when the browser suppresses dialogs (the
  // "prevent additional dialogs" checkbox, an embedding iframe, automation),
  // which made the whole delete abort SILENTLY — the reported "clicking delete
  // does nothing". The same went for the alert() that carried the server's
  // refusal reason, so even a correct "this event has bookings" never showed.
  const [confirmTarget, setConfirmTarget] = useState<OeAdminEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    const e = confirmTarget;
    if (!e || deleting) return;
    setDeleting(true);
    try {
      await deleteEvent(e.id);
      setConfirmTarget(null);
      toast.success(`已删除「${e.display_label}」`);
      load();
    } catch (er) {
      const msg = er instanceof Error ? er.message : "删除失败";
      // The server returns the booking count with has_bookings — show it, so the
      // reason is concrete instead of a bare refusal.
      const n = (er as { detail?: { count?: number } })?.detail?.count;
      setConfirmTarget(null);
      toast.error(
        msg === "has_bookings"
          ? `「${e.display_label}」已有 ${n ?? ""}${n ? " 个" : ""}报名，不能删除。可以把状态改成「关闭 off」，它就不再对外开放。`
          : msg,
        { duration: 8000 },
      );
    } finally {
      setDeleting(false);
    }
  };

  if (err && !events) {
    return (
      <div className="glass-card rounded-2xl p-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div><p className="font-medium text-sm">加载失败</p><p className="text-sm text-muted-foreground mt-0.5">{err}</p></div>
      </div>
    );
  }
  if (!events) {
    return <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">共 {events.length} 个活动</p>
        <button onClick={openCreate} className="h-9 px-4 rounded-xl text-[#141414] text-sm font-medium flex items-center gap-1.5" style={{ background: "#fed50a" }}>
          <Plus className="w-4 h-4" /> 新建活动
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {events.map((e) => {
          const cap = e.capacity != null ? e.capacity : (e.floor_plan_id ? "按平面图" : "—");
          return (
            <div key={e.id} className="glass-card rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[#fed50a] shrink-0" style={{ background: "#141414" }}>
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{e.display_label}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_META[e.status].cls}`}>{STATUS_META[e.status].label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {e.start_date} → {e.end_date} · {e.time_slot}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    RM {Number(e.price_per_seat).toFixed(2)}/座 · 容量 {cap} · 已占 {e.claimed_seats} · 报名 {e.booking_count}
                    {e.floor_plan_name ? ` · ${e.floor_plan_name}` : ""}
                    {e.seat_selection_enabled ? " · 可选座" : " · 数量制"}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(e)} className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground" title="编辑">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setConfirmTarget(e)} className="w-9 h-9 rounded-lg bg-[#141414]/[0.06] flex items-center justify-center text-[#141414] hover:bg-[#141414]/[0.12]" title="删除">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {formOpen && form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setFormOpen(false)}>
          <div className="w-full max-w-lg rounded-3xl bg-background shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0 bg-background z-10 border-b border-border/40">
              <p className="font-display font-bold">{editId ? "编辑活动" : "新建活动"}</p>
              <button onClick={() => setFormOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="活动名称">
                <input value={form.display_label} onChange={(e) => setForm({ ...form, display_label: e.target.value })} className={inp} placeholder="25 - 26 July 2026 (Sat - Sun)" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="开始日期"><input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inp} /></Field>
                <Field label="结束日期"><input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={inp} /></Field>
              </div>
              <Field label="时间段"><input value={form.time_slot} onChange={(e) => setForm({ ...form, time_slot: e.target.value })} className={inp} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="主题（中文）"><input value={form.theme_zh} onChange={(e) => setForm({ ...form, theme_zh: e.target.value })} className={inp} /></Field>
                <Field label="主题（English）"><input value={form.theme_en} onChange={(e) => setForm({ ...form, theme_en: e.target.value })} className={inp} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="须知（中文）"><textarea value={form.notice_zh} onChange={(e) => setForm({ ...form, notice_zh: e.target.value })} className={`${inp} h-20 py-2`} /></Field>
                <Field label="须知（English）"><textarea value={form.notice_en} onChange={(e) => setForm({ ...form, notice_en: e.target.value })} className={`${inp} h-20 py-2`} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="票价 RM/座"><input value={form.price_per_seat} onChange={(e) => setForm({ ...form, price_per_seat: e.target.value })} inputMode="decimal" className={inp} /></Field>
                <Field label="容量（留空=按平面图）"><input value={form.capacity ?? ""} onChange={(e) => setForm({ ...form, capacity: e.target.value })} inputMode="numeric" className={inp} /></Field>
              </div>
              <Field label="平面图">
                <select value={form.floor_plan_id ?? ""} onChange={(e) => setForm({ ...form, floor_plan_id: e.target.value || null })} className={inp}>
                  <option value="">（不绑定）</option>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name}（{p.physical_seats} 座）</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="状态">
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as OeEventStatus })} className={inp}>
                    <option value="live">开放 live</option>
                    <option value="display">只展示 display</option>
                    <option value="off">关闭 off</option>
                  </select>
                </Field>
                <Field label="排序"><input value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} inputMode="numeric" className={inp} /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.seat_selection_enabled} onChange={(e) => setForm({ ...form, seat_selection_enabled: e.target.checked })} />
                开放选座（关闭则为数量制）
              </label>

              {formErr && <p className="text-sm text-destructive">{formErr}</p>}

              <div className="flex gap-2 pt-2 border-t border-border/40">
                <button onClick={() => setFormOpen(false)} className="flex-1 h-11 rounded-xl bg-muted text-sm font-medium">取消</button>
                <button onClick={save} disabled={saving} className="flex-1 h-11 rounded-xl text-[#141414] text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40" style={{ background: "#fed50a" }}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editId ? "保存" : "创建"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation — in-app, so it can't be suppressed like the native
          confirm() this replaced. */}
      {confirmTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => !deleting && setConfirmTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white border-2 border-[#141414] p-5"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#141414] flex items-center justify-center text-[#fed50a] shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-display font-bold">删除活动？</p>
                <p className="text-sm text-muted-foreground mt-1 break-words">
                  「{confirmTarget.display_label}」将被永久删除，无法撤销。
                  {(confirmTarget.booking_count ?? 0) > 0 && (
                    <span className="block mt-1 font-medium text-[#141414]">
                      这个活动已有 {confirmTarget.booking_count} 个报名，删不掉——请改用「关闭 off」。
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                disabled={deleting}
                className="flex-1 h-10 rounded-xl border-2 border-[#141414] bg-white text-sm font-medium disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 h-10 rounded-xl bg-[#141414] text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = "w-full h-10 rounded-xl border border-border bg-background px-3 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
