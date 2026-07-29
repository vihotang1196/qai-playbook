import { useCallback, useEffect, useState } from "react";
import { Loader2, X, Archive, ArchiveRestore, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  listBookings,
  archiveBooking,
  deleteBookingHard,
  type OeBookingRow,
  type OeBookingStatus,
} from "@/lib/offlineEventAdmin";
import { requiresHardDeleteGate, hasAttendance } from "@/lib/offlineEventDelete";
import { formatEventDateCompact } from "@/lib/offlineEventFormat";
import ConfirmDialog from "@/components/ConfirmDialog";
import UnarchiveModal from "./UnarchiveModal";

/**
 * The archive, in its own modal (batch 5).
 *
 * The main list used to toggle archived rows into itself, which made "where did
 * my booking go?" a guessing game and put permanent delete one click away from
 * ordinary work. Now: the main list shows live bookings only, and EVERYTHING
 * archive-related — un-archive and the only permanent-delete entry in the app —
 * happens here.
 *
 * Permanent delete is gated by requiresHardDeleteGate (offlineEventDelete.ts).
 * That function is the single decision point; nothing in here re-tests its
 * conditions.
 */

const STATUS_LABEL: Record<OeBookingStatus, string> = {
  confirmed: "已确认",
  pending: "待付款",
  cancelled: "已取消",
};

function fmtArchivedAt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString([], {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function ArchiveModal({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  /** Called after anything changes, so the main list + its counts reload. */
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<OeBookingRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // One row awaiting a permanent-delete confirmation (tier A or B).
  const [confirmDelete, setConfirmDelete] = useState<OeBookingRow | null>(null);
  // Single un-archive goes through the seat picker (batch 7a) — archiving freed
  // the seats, so coming back means claiming seats again.
  const [unarchiving, setUnarchiving] = useState<OeBookingRow | null>(null);
  const [confirmBulkUnarchive, setConfirmBulkUnarchive] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const load = useCallback(() => {
    setRows(null);
    setErr(null);
    setPicked(new Set());
    listBookings({ archivedOnly: true, limit: 500 })
      .then((r) => setRows(r.bookings))
      .catch((e) => setErr(e instanceof Error ? e.message : "加载失败"));
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  if (!open) return null;

  const all = rows ?? [];
  const selected = all.filter((b) => picked.has(b.booking_id));
  const allPicked = all.length > 0 && picked.size === all.length;
  // Tier A rows in the current selection — a bulk delete must refuse them by
  // NAME, not just refuse. "Some of these need care" without saying which one
  // leaves the admin unable to act.
  const gatedInSelection = selected.filter(requiresHardDeleteGate);

  const toggle = (code: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const toggleAll = () =>
    setPicked((prev) => (prev.size === all.length ? new Set() : new Set(all.map((b) => b.booking_id))));

  // BULK un-archive re-claims each booking's ORIGINAL seats (no picker — there is
  // no sane way to pick seats for many bookings in one dialog). Nothing is taken
  // from anyone: a booking whose old seats are gone is REFUSED by the server and
  // stays archived, and we name it so it can be un-archived one at a time with
  // the picker.
  const doBulkUnarchive = async (codes: string[]) => {
    setBusy(true);
    let ok = 0;
    const blocked: string[] = [];
    const failed: string[] = [];
    try {
      for (const code of codes) {
        try {
          await archiveBooking(code, false);
          ok++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "失败";
          if (msg === "seats_unavailable") blocked.push(code);
          else failed.push(`${code}（${msg}）`);
        }
      }
      if (ok) toast.success(`已取消归档 ${ok} 笔`);
      if (blocked.length) {
        toast.error(
          `${blocked.length} 笔原座位已被订走，仍是已归档：${blocked.join("、")} —— 请逐笔取消归档并重新选座`,
          { duration: 12000 },
        );
      }
      if (failed.length) toast.error(`${failed.length} 笔失败：${failed.join("；")}`, { duration: 8000 });
      load();
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (codes: string[]) => {
    setBusy(true);
    let ok = 0;
    const failed: string[] = [];
    try {
      for (const code of codes) {
        try {
          await deleteBookingHard(code);
          ok++;
        } catch (e) {
          // The server can refuse; the admin must be told WHY rather than left
          // looking at a button that did nothing.
          failed.push(`${code}（${e instanceof Error ? e.message : "失败"}）`);
        }
      }
      if (ok) toast.success(`已永久删除 ${ok} 笔，座位已释放`);
      if (failed.length) toast.error(`${failed.length} 笔未删除：${failed.join("；")}`, { duration: 10000 });
      load();
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const tierA = confirmDelete ? requiresHardDeleteGate(confirmDelete) : false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={() => !busy && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-4xl rounded-3xl bg-background shadow-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2 shrink-0">
          <Archive className="w-4 h-4" />
          <p className="font-display font-bold">已归档的报名</p>
          <span className="text-xs text-muted-foreground ml-1">{all.length} 笔</span>
          <button
            onClick={onClose}
            className="ml-auto w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Bulk bar — only once something is picked, so it can't be mistaken for
            an always-on toolbar. */}
        {selected.length > 0 && (
          <div className="px-5 py-3 border-b border-border/40 flex flex-wrap items-center gap-2 bg-muted/40 shrink-0">
            <span className="text-sm font-medium">已选 {selected.length} 笔</span>
            <button
              disabled={busy}
              onClick={() => setConfirmBulkUnarchive(true)}
              className="h-9 px-3 rounded-xl bg-white border-2 border-[#141414] text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <ArchiveRestore className="w-4 h-4" /> 批量取消归档
            </button>
            <button
              disabled={busy}
              onClick={() => setConfirmBulkDelete(true)}
              className="h-9 px-3 rounded-xl bg-[#141414] text-[#fed50a] text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> 批量永久删除
            </button>
            <button
              disabled={busy}
              onClick={() => setPicked(new Set())}
              className="h-9 px-3 rounded-xl text-sm text-muted-foreground disabled:opacity-50"
            >
              清除选择
            </button>
          </div>
        )}

        <div className="overflow-auto flex-1">
          {err && (
            <div className="p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">{err}</p>
            </div>
          )}
          {rows === null ? (
            <div className="p-16 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : all.length === 0 ? (
            <div className="p-16 text-center text-sm text-muted-foreground">暂无已归档的报名。</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border/40">
                  <th className="px-4 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={allPicked}
                      onChange={toggleAll}
                      aria-label="全选"
                      className="w-4 h-4 accent-[#141414]"
                    />
                  </th>
                  <th className="px-3 py-2 font-medium">报名码</th>
                  <th className="px-3 py-2 font-medium">邮箱</th>
                  <th className="px-3 py-2 font-medium">活动日期</th>
                  <th className="px-3 py-2 font-medium">座位</th>
                  <th className="px-3 py-2 font-medium text-right">金额</th>
                  <th className="px-3 py-2 font-medium">原状态</th>
                  <th className="px-3 py-2 font-medium">归档时间</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {all.map((b) => (
                  <tr key={b.booking_id} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={picked.has(b.booking_id)}
                        onChange={() => toggle(b.booking_id)}
                        aria-label={`选择 ${b.booking_id}`}
                        className="w-4 h-4 accent-[#141414]"
                      />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">{b.booking_id}</td>
                    <td className="px-3 py-3 truncate max-w-[150px]">{b.email || "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs">
                      {b.event_start_date
                        ? formatEventDateCompact(b.event_start_date, b.event_end_date ?? b.event_start_date)
                        : <span className="text-muted-foreground">未关联活动</span>}
                    </td>
                    <td className="px-3 py-3 text-xs">{b.seats.join("、") || "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                      {b.total > 0 ? `RM ${b.total.toFixed(2)}` : "免费"}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs">{STATUS_LABEL[b.status]}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {fmtArchivedAt(b.archived_at)}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        disabled={busy}
                        title="取消归档（要重新选座）"
                        aria-label={`取消归档 ${b.booking_id}`}
                        onClick={() => setUnarchiving(b)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#141414] hover:bg-[#141414]/[0.08] disabled:opacity-40"
                      >
                        <ArchiveRestore className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        title="永久删除"
                        aria-label={`永久删除 ${b.booking_id}`}
                        onClick={() => setConfirmDelete(b)}
                        className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#141414] hover:bg-[#141414]/[0.08] disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Single un-archive → the seat picker ─────────────────────────────── */}
      {unarchiving && (
        <UnarchiveModal
          booking={unarchiving}
          onClose={() => setUnarchiving(null)}
          onDone={() => {
            toast.success(`${unarchiving.booking_id} 已取消归档`);
            load();
            onChanged();
          }}
        />
      )}

      {/* ── Bulk un-archive: re-claims the original seats, refuses the rest ─── */}
      <ConfirmDialog
        open={confirmBulkUnarchive}
        busy={busy}
        title={`取消归档 ${selected.length} 笔？`}
        description={
          <>
            这些报名将回到正常列表，顾客可以再次签到入场。
            <br />
            批量操作会<b className="text-[#141414]">重新占用它们原本的座位</b>；
            原座位已被别人订走的那几笔<b className="text-[#141414]">会被拒绝、仍留在归档里</b>，
            之后逐笔取消归档时可以重新选座。
          </>
        }
        confirmLabel="取消归档"
        cancelLabel="返回"
        onConfirm={() => {
          setConfirmBulkUnarchive(false);
          doBulkUnarchive(selected.map((b) => b.booking_id));
        }}
        onCancel={() => setConfirmBulkUnarchive(false)}
      />

      {/* ── Bulk permanent delete — tier B rows ONLY ─────────────────────────
          A batch containing ANY tier-A booking is refused WHOLE. Tier A must
          stay one-at-a-time with the code typed out; letting a batch carry one
          through would be a way around the gate, which is the entire point of
          having it. */}
      <ConfirmDialog
        open={confirmBulkDelete}
        danger
        busy={busy}
        title={gatedInSelection.length > 0 ? "这批不能一起删除" : `永久删除 ${selected.length} 笔？`}
        description={
          gatedInSelection.length > 0 ? (
            <>
              以下 <b className="text-[#141414]">{gatedInSelection.length}</b> 笔涉及收款或出勤记录，
              必须单独删除并手打报名码：
              <br />
              {gatedInSelection.map((b) => (
                <span key={b.booking_id} className="block font-mono text-xs text-[#141414]">
                  · {b.booking_id}
                  {b.total > 0 ? ` · RM ${b.total.toFixed(2)}` : ""}
                  {hasAttendance(b) ? " · 已签到" : ""}
                </span>
              ))}
              <br />
              请把它们从选择中去掉，或<b className="text-[#141414]">请单独删除</b>。
            </>
          ) : (
            <>
              这 {selected.length} 笔将被<b className="text-[#141414]">彻底删除、无法恢复</b>，座位将被释放。
              （它们都没有收款记录，也没有出勤记录。）
            </>
          )
        }
        confirmLabel={gatedInSelection.length > 0 ? "我知道了" : "永久删除"}
        cancelLabel="返回"
        onConfirm={() => {
          // The refusal branch's only action is dismissal — no delete path here.
          if (gatedInSelection.length > 0) {
            setConfirmBulkDelete(false);
            return;
          }
          setConfirmBulkDelete(false);
          doDelete(selected.map((b) => b.booking_id));
        }}
        onCancel={() => setConfirmBulkDelete(false)}
      />

      {/* ── Single permanent delete — tier A (typed code) or tier B ─────────── */}
      <ConfirmDialog
        open={!!confirmDelete}
        danger
        busy={busy}
        title="永久删除这张订单？"
        description={
          tierA ? (
            <>
              永久删除后不可恢复。
              <br />· 此单的<b className="text-[#141414]">收款记录将从系统中消失</b>
              （Stripe 后台仍有记录，但后台无法对账）
              <br />·{" "}
              {confirmDelete && hasAttendance(confirmDelete)
                ? <>此单<b className="text-[#141414]">已签到，出勤记录将一并消失</b></>
                : <>若该顾客已签到，出勤记录一并消失</>}
              <br />· 座位将被释放
              <br />
              请输入报名码 <b className="text-[#141414] font-mono">{confirmDelete?.booking_id}</b> 确认。
            </>
          ) : (
            <>
              订单 <b className="text-[#141414] font-mono">{confirmDelete?.booking_id}</b>{" "}
              <b className="text-[#141414]">不可恢复</b>，座位将被释放。
            </>
          )
        }
        inputLabel={tierA ? "报名码" : undefined}
        inputPlaceholder={tierA ? confirmDelete?.booking_id : undefined}
        requireInputValue={tierA ? confirmDelete?.booking_id : undefined}
        confirmLabel="永久删除"
        cancelLabel="返回"
        onConfirm={() => {
          const code = confirmDelete?.booking_id;
          setConfirmDelete(null);
          if (code) doDelete([code]);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
