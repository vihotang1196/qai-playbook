import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertCircle, Search, X, Ticket, RefreshCw, Archive, Ban, QrCode, UserPlus, Armchair, CalendarClock } from "lucide-react";
import {
  listBookings,
  ORPHAN_EVENT,
  getBookingDetail,
  cancelBooking,
  archiveBooking,
  getCheckinEvents,
  type OeBookingRow,
  type OeBookingDetail,
  type OeBookingEvent,
  type OeBookingStatus,
  type OeCheckinEvent,
} from "@/lib/offlineEventAdmin";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatEventDateCompact } from "@/lib/offlineEventFormat";
import { QrTicket } from "@/components/offline-event/QrTicket";
import ManualAddModal from "@/components/offline-event/ManualAddModal";
import SeatOpModal from "@/components/offline-event/SeatOpModal";
import ArchiveModal from "@/components/offline-event/ArchiveModal";
import { blocksArchive, hasPaymentTrace } from "@/lib/offlineEventDelete";

/**
 * Offline Event admin — P7a bookings management (`/admin/offline-event/bookings`).
 * List / search / filter all bookings, open one for detail (seats, payment,
 * check-in, QR), and cancel (void + free seats) or archive (hide). All through
 * the requireAdmin-gated `offline-event-admin` fn — the frontend never touches
 * the RLS-locked oe_ tables directly.
 *
 * Batch 5: this list shows LIVE bookings only. Archived rows live behind the
 * 「已归档」button in their own modal, and permanent delete exists ONLY there —
 * it must never sit one click away from everyday work.
 */

const STATUS_META: Record<OeBookingStatus, { label: string; cls: string }> = {
  confirmed: { label: "已确认", cls: "bg-[#fed50a] text-[#141414]" },
  pending: { label: "待付款", cls: "bg-white text-[#141414] border border-[#141414]/40" },
  cancelled: { label: "已取消", cls: "bg-[#141414]/[0.06] text-[#141414] border border-[#141414]/30" },
};

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function OfflineEventBookings() {
  const [events, setEvents] = useState<OeCheckinEvent[]>([]);
  const [rows, setRows] = useState<OeBookingRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const [eventId, setEventId] = useState("");
  const [status, setStatus] = useState<OeBookingStatus | "">("");
  // How many rows the archive holds — named on the button so an archived
  // booking never just looks lost. Shown even at 0 (greyed), because a button
  // that disappears is a feature the owner has to remember exists.
  const [archivedCount, setArchivedCount] = useState(0);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [orphanCount, setOrphanCount] = useState(0);
  // Row whose archive/un-archive is awaiting confirmation.
  const [confirmArchive, setConfirmArchive] = useState<OeBookingRow | null>(null);
  const [search, setSearch] = useState("");
  // Multi-select on the main list (bulk archive only — no delete path here).
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirmBulkArchive, setConfirmBulkArchive] = useState(false);
  const [confirmBulkCancel, setConfirmBulkCancel] = useState(false);

  const [detail, setDetail] = useState<{ booking: OeBookingDetail; event: OeBookingEvent } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [seatOp, setSeatOp] = useState<{ mode: "seat" | "date"; booking: { booking_id: string; event_id: string | null; event_label: string; seats: string[] } } | null>(null);

  useEffect(() => {
    getCheckinEvents().then(setEvents).catch(() => {/* filter still usable without it */});
  }, []);

  const load = useCallback(() => {
    setRows(null);
    setErr(null);
    setPicked(new Set());
    listBookings({ eventId, status, search })
      .then((r) => {
        setRows(r.bookings);
        setTotal(r.total);
        setArchivedCount(r.archivedCount ?? 0);
        setOrphanCount(r.orphanCount ?? 0);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "加载失败"));
  }, [eventId, status, search]);

  // Reload on filter changes (search is applied explicitly via the box below).
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, status]);

  const openDetail = async (code: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await getBookingDetail(code);
      setDetail(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载详情失败");
    } finally {
      setDetailLoading(false);
    }
  };

  // Confirmations use the in-app dialog, never window.confirm — a suppressed
  // native dialog returns false and the action would abort SILENTLY.
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const doCancel = async (code: string) => {
    setBusy(true);
    try {
      await cancelBooking(code);
      setConfirmCancel(null);
      toast.success(`订单 ${code} 已取消，座位已释放`);
      await openDetail(code);
      load();
    } catch (e) {
      setConfirmCancel(null);
      toast.error(e instanceof Error ? e.message : "取消失败");
    } finally {
      setBusy(false);
    }
  };

  const doArchive = async (code: string, archived: boolean) => {
    setBusy(true);
    try {
      await archiveBooking(code, archived);
      if (detail) await openDetail(code);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "归档失败");
    } finally {
      setBusy(false);
    }
  };

  // ── Multi-select bulk archive ───────────────────────────────────────────
  // Skips exactly what the per-row archive button refuses (blocksArchive): a LIVE
  // booking that took money. Since batch 7a archiving frees the seats, doing that
  // to a paid booking leaves the customer with no seat, no entry and no refund.
  // Cancelled bookings are archivable — see blocksArchive for why.
  const pickedRows = (rows ?? []).filter((b) => picked.has(b.booking_id));
  const bulkSkipped = pickedRows.filter(blocksArchive);
  const bulkArchivable = pickedRows.filter((b) => !blocksArchive(b));
  // Seats that will ACTUALLY be freed. A cancelled booking keeps its seat LABELS
  // on the row but holds no `oe_booked_seats` rows, so counting its labels would
  // promise seats that were freed long ago.
  const bulkSeatCount = bulkArchivable.reduce(
    (n, b) => n + (b.status === "cancelled" ? 0 : b.seats.length),
    0,
  );

  const togglePick = (code: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  // ── Multi-select bulk cancel ────────────────────────────────────────────
  // Deliberately does NOT reuse bulk archive's skip rule. Archiving skips
  // payment-traced bookings because it neither refunds nor issues credit; a
  // CANCEL is exactly what those bookings need — it releases their seats — and
  // skipping them would leave the seats that matter most still locked, i.e. a
  // batch action that can't do the job it was added for. So nothing is skipped
  // for money reasons; the money is spelled out in the confirmation instead.
  //
  // Rows already `cancelled` ARE left out of the batch: cancelBooking is
  // idempotent for them (returns alreadyCancelled), so including them would
  // only inflate the success count. They are counted separately in the dialog.
  const bulkCancelTargets = pickedRows.filter((b) => b.status !== "cancelled");
  const bulkCancelAlready = pickedRows.filter((b) => b.status === "cancelled");
  const bulkCancelSeats = bulkCancelTargets.reduce((n, b) => n + b.seats.length, 0);
  const bulkCancelPaid = bulkCancelTargets.filter(hasPaymentTrace);
  const bulkCancelPaidTotal = bulkCancelPaid.reduce((n, b) => n + (b.total ?? 0), 0);

  const doBulkCancel = async () => {
    setBusy(true);
    let ok = 0;
    const failed: string[] = [];
    try {
      for (const b of bulkCancelTargets) {
        try {
          await cancelBooking(b.booking_id);
          ok++;
        } catch (e) {
          // One failure must not abort the rest of the batch — and the admin
          // needs the code AND the reason, not just a count.
          failed.push(`${b.booking_id}（${e instanceof Error ? e.message : "失败"}）`);
        }
      }
      if (ok) toast.success(`已取消 ${ok} 笔，座位已释放`);
      if (failed.length) toast.error(`${failed.length} 笔未取消：${failed.join("；")}`, { duration: 12000 });
      load();
    } finally {
      setBusy(false);
    }
  };

  const doBulkArchive = async () => {
    setBusy(true);
    let ok = 0;
    const failed: string[] = [];
    try {
      for (const b of bulkArchivable) {
        try {
          await archiveBooking(b.booking_id, true);
          ok++;
        } catch {
          failed.push(b.booking_id);
        }
      }
      if (ok) toast.success(`已归档 ${ok} 笔`);
      if (bulkSkipped.length) {
        toast.info(
          `其中 ${bulkSkipped.length} 笔已收款或仍有付款痕迹，已跳过（需等批 7b 额度系统上线）`,
          { duration: 9000 },
        );
      }
      if (failed.length) toast.error(`${failed.length} 笔失败：${failed.join("、")}`, { duration: 8000 });
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          >
            {/* Filter BY DATE, but the option's value stays the event uuid —
                two events on the same day would otherwise be indistinguishable
                and the filter would silently mix them. */}
            <option value="">全部活动</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{formatEventDateCompact(e.start_date, e.end_date)}</option>
            ))}
            {/* Rendered only when orphans actually exist (event_id IS NULL, which
                happens when an event with only-cancelled bookings is deleted —
                the FK is ON DELETE SET NULL). A permanent zero-count option is
                noise; a missing one hides real rows. Note the DEFAULT view above
                (value "") applies no event filter at all, so orphans are always
                visible there — that, not this option, is the real safeguard. */}
            {orphanCount > 0 && <option value={ORPHAN_EVENT}>未关联活动（{orphanCount}）</option>}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as OeBookingStatus | "")}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="">全部状态</option>
            <option value="confirmed">已确认</option>
            <option value="pending">待付款</option>
            <option value="cancelled">已取消</option>
          </select>
          {/* The archive is a PLACE, not a view toggle: archived rows never mix
              into this list any more. Rendered even at 0 (greyed but present) so
              the entry point is always where the owner last saw it. */}
          <button
            type="button"
            onClick={() => setArchiveOpen(true)}
            className={`inline-flex items-center gap-1.5 h-10 rounded-xl px-3 text-sm font-medium border-2 transition-colors ${
              archivedCount > 0
                ? "border-[#141414] bg-[#fed50a] text-[#141414]"
                : "border-border text-muted-foreground"
            }`}
            title="打开归档（取消归档 / 永久删除都在里面）"
          >
            <Archive className="w-4 h-4" />
            已归档（{archivedCount}）
          </button>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="搜索报名码或邮箱…"
              className="w-full h-10 rounded-xl border border-border bg-background pl-9 pr-3 text-sm"
            />
          </div>
          <button onClick={load} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5">
            <Search className="w-4 h-4" /> 搜索
          </button>
          <button onClick={() => { setSearch(""); setEventId(""); setStatus(""); }} className="h-10 px-3 rounded-xl bg-muted text-sm text-muted-foreground flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4" /> 重置
          </button>
        </div>
      </div>

      {err && (
        <div className="glass-card rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">{err}</p>
        </div>
      )}

      {/* List */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
          <Ticket className="w-4 h-4 text-foreground" />
          <span className="text-sm font-medium">报名列表</span>
          <span className="text-xs text-muted-foreground ml-auto">共 {total} 条</span>
          <button
            onClick={() => setAddOpen(true)}
            className="h-8 px-3 rounded-lg text-[#141414] text-xs font-medium flex items-center gap-1"
            style={{ background: "#fed50a" }}
          >
            <UserPlus className="w-3.5 h-3.5" /> 手动加票
          </button>
        </div>
        {/* Bulk bar — appears only with a selection, so it never looks like a
            permanent toolbar. Archive only: permanent delete lives in the
            archive modal and nowhere else. */}
        {pickedRows.length > 0 && (
          <div className="px-4 py-3 border-b border-border/40 flex flex-wrap items-center gap-2 bg-muted/40">
            <span className="text-sm font-medium">已选 {pickedRows.length} 笔</span>
            <button
              disabled={busy}
              onClick={() => setConfirmBulkArchive(true)}
              className="h-9 px-3 rounded-xl bg-white border-2 border-[#141414] text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Archive className="w-4 h-4" /> 批量归档
            </button>
            <button
              disabled={busy}
              onClick={() => setConfirmBulkCancel(true)}
              className="h-9 px-3 rounded-xl bg-[#141414] text-[#fed50a] text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Ban className="w-4 h-4" /> 批量取消订单
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
        {rows === null ? (
          <div className="p-10 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">没有符合条件的报名。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border/40">
                  <th className="px-4 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && picked.size === rows.length}
                      onChange={() =>
                        setPicked((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((b) => b.booking_id))))
                      }
                      aria-label="全选"
                      className="w-4 h-4 accent-[#141414]"
                    />
                  </th>
                  <th className="px-4 py-2 font-medium">报名码</th>
                  <th className="px-4 py-2 font-medium">邮箱</th>
                  <th className="px-4 py-2 font-medium">子账号</th>
                  <th className="px-4 py-2 font-medium">活动</th>
                  <th className="px-4 py-2 font-medium">座位</th>
                  <th className="px-4 py-2 font-medium">午餐</th>
                  <th className="px-4 py-2 font-medium text-right">金额</th>
                  <th className="px-4 py-2 font-medium">状态</th>
                  <th className="px-4 py-2 font-medium">签到</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr
                    key={b.booking_id}
                    className="border-b border-border/30 hover:bg-muted/40 cursor-pointer"
                    onClick={() => openDetail(b.booking_id)}
                  >
                    {/* stopPropagation on the cell: ticking a row must not also
                        open its detail modal. */}
                    <td className="px-4 py-3.5" onClick={(ev) => ev.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={picked.has(b.booking_id)}
                        onChange={() => togglePick(b.booking_id)}
                        aria-label={`选择 ${b.booking_id}`}
                        className="w-4 h-4 accent-[#141414]"
                      />
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs whitespace-nowrap">{b.booking_id}</td>
                    <td className="px-4 py-3.5 truncate max-w-[160px]">{b.email || "—"}</td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-muted-foreground truncate max-w-[120px]" title={b.ghl_location_id || undefined}>{b.ghl_location_id || "—"}</td>
                    <td className="px-4 py-3.5 truncate max-w-[160px]">{b.event_label}</td>
                    <td className="px-4 py-3.5 tabular-nums">{b.seats.length}</td>
                    <td className="px-4 py-3.5 tabular-nums text-xs">{b.lunch_qty > 0 ? `${b.lunch_qty} 份` : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums">{b.total > 0 ? `RM ${b.total.toFixed(2)}` : "免费"}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${STATUS_META[b.status].cls}`}>
                        {STATUS_META[b.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                      {b.day1_status === "attended" ? "D1✓" : "D1·"} {b.day2_status === "attended" ? "D2✓" : "D2·"}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <QrCode className="w-4 h-4 text-muted-foreground inline" />
                      {/* stopPropagation: the row itself opens the detail modal,
                          and archiving must not also open it. */}
                      {/* This list is live-only, so the per-row action is always
                          "archive" — un-archive lives in the archive modal.
                          Disabled for a live booking that took money: archiving
                          now frees its seat, and no refund/credit exists yet. */}
                      <button
                        type="button"
                        disabled={blocksArchive(b)}
                        title={
                          blocksArchive(b)
                            ? "此单已收款，退款/额度功能尚未上线（批 7b），暂不可归档。如需处理请先取消订单。"
                            : "归档（座位会被释放）"
                        }
                        aria-label={`归档 ${b.booking_id}`}
                        onClick={(ev) => { ev.stopPropagation(); setConfirmArchive(b); }}
                        className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-lg align-middle text-[#141414] hover:bg-[#141414]/[0.08] disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setDetail(null)}>
          <div className="w-full max-w-lg rounded-3xl bg-background shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {detailLoading || !detail ? (
              <div className="p-16 flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-sm font-bold">{detail.booking.booking_id}</p>
                    <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[11px] ${STATUS_META[detail.booking.status].cls}`}>
                      {STATUS_META[detail.booking.status].label}
                    </span>
                    {detail.booking.is_archived && <span className="ml-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] bg-muted text-muted-foreground">已归档</span>}
                  </div>
                  <button onClick={() => setDetail(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="col-span-2">
                    <p className="text-[11px] text-muted-foreground">活动</p>
                    <p>{detail.booking.event_label}</p>
                    {detail.event && <p className="text-xs text-muted-foreground">{detail.event.start_date} → {detail.event.end_date} · {detail.event.time_slot}</p>}
                  </div>
                  <div><p className="text-[11px] text-muted-foreground">邮箱</p><p className="break-all">{detail.booking.email || "—"}</p></div>
                  <div><p className="text-[11px] text-muted-foreground">电话</p><p>{detail.booking.phone || "—"}</p></div>
                  <div><p className="text-[11px] text-muted-foreground">子账号 (location)</p><p className="break-all text-xs">{detail.booking.ghl_location_id || "—"}</p></div>
                  <div><p className="text-[11px] text-muted-foreground">午餐</p><p>{detail.booking.lunch_qty} 份</p></div>
                  <div className="col-span-2">
                    <p className="text-[11px] text-muted-foreground">座位（{detail.booking.seats.length}）</p>
                    <p className="text-sm">{detail.booking.seats.join("、") || "—"}</p>
                  </div>
                  <div><p className="text-[11px] text-muted-foreground">金额</p><p className="tabular-nums">{detail.booking.total > 0 ? `RM ${detail.booking.total.toFixed(2)}` : "免费"}</p></div>
                  <div><p className="text-[11px] text-muted-foreground">付款备注</p><p className="text-xs break-all">{detail.booking.payment_note || "—"}</p></div>
                  <div className="col-span-2">
                    <p className="text-[11px] text-muted-foreground">签到</p>
                    <p className="text-sm">
                      Day 1: {detail.booking.day1_status === "attended" ? `已到 ${fmtDateTime(detail.booking.day1_checked_in_at)}` : "未到"} ·
                      {" "}Day 2: {detail.booking.day2_status === "attended" ? `已到 ${fmtDateTime(detail.booking.day2_checked_in_at)}` : "未到"}
                    </p>
                  </div>
                  {detail.booking.receipt_url && (
                    <div className="col-span-2">
                      <a href={detail.booking.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-foreground underline">Stripe 收据</a>
                    </div>
                  )}
                </div>

                {detail.booking.status === "confirmed" && detail.booking.qr_payload && (
                  <div className="flex justify-center pt-1">
                    <QrTicket
                      lang="cn"
                      booking={{
                        booking_id: detail.booking.booking_id,
                        qr_payload: detail.booking.qr_payload,
                        seats: detail.booking.seats,
                        event_label: detail.booking.event_label,
                        total: detail.booking.total,
                      }}
                    />
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-border/40">
                  {detail.booking.status !== "cancelled" && (
                    <div className="flex gap-2">
                      <button
                        disabled={busy}
                        onClick={() =>
                          setSeatOp({
                            mode: "seat",
                            booking: {
                              booking_id: detail.booking.booking_id,
                              event_id: detail.booking.event_id,
                              event_label: detail.booking.event_label,
                              seats: detail.booking.seats,
                            },
                          })
                        }
                        className="flex-1 h-10 rounded-xl bg-muted text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Armchair className="w-4 h-4" /> 改座
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          setSeatOp({
                            mode: "date",
                            booking: {
                              booking_id: detail.booking.booking_id,
                              event_id: detail.booking.event_id,
                              event_label: detail.booking.event_label,
                              seats: detail.booking.seats,
                            },
                          })
                        }
                        className="flex-1 h-10 rounded-xl bg-muted text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <CalendarClock className="w-4 h-4" /> 改期
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {detail.booking.status !== "cancelled" && (
                      <button
                        disabled={busy}
                        onClick={() => setConfirmCancel(detail.booking.booking_id)}
                        className="flex-1 h-10 rounded-xl bg-[#141414]/[0.06] text-[#141414] text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Ban className="w-4 h-4" /> 取消订单
                      </button>
                    )}
                    <button
                      disabled={busy || blocksArchive(detail.booking)}
                      title={
                        blocksArchive(detail.booking)
                          ? "此单已收款，退款/额度功能尚未上线（批 7b），暂不可归档。如需处理请先取消订单。"
                          : undefined
                      }
                      onClick={() => setConfirmArchive(detail.booking)}
                      className="flex-1 h-10 rounded-xl bg-muted text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Archive className="w-4 h-4" /> 归档
                    </button>
                  </div>
                  {/* No permanent-delete entry here on purpose (batch 5): the only
                      way to delete is 归档 → 已归档 modal, so an irreversible
                      action can't be reached from everyday booking work. */}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ManualAddModal open={addOpen} onClose={() => setAddOpen(false)} onDone={load} />
      {seatOp && (
        <SeatOpModal
          open
          mode={seatOp.mode}
          booking={seatOp.booking}
          events={events}
          onClose={() => setSeatOp(null)}
          onDone={() => {
            load();
            openDetail(seatOp.booking.booking_id);
          }}
        />
      )}

      {/* Archive confirmation. Since batch 7a archiving RELEASES the seats, so the
          dialog has to say that — "hidden from the list" is no longer the whole
          story, and the seat can be gone by the time anyone un-archives. Bookings
          that took money can't get here at all (blocksArchive disables the
          button); credit/refund on archive is still batch 7b. */}
      <ConfirmDialog
        open={!!confirmArchive}
        danger={!!confirmArchive && confirmArchive.status !== "cancelled" && confirmArchive.seats.length > 0}
        title="归档这笔报名？"
        description={
          <>
            「<b className="text-[#141414]">{confirmArchive?.booking_id}</b>」将从默认列表隐藏
            （状态：{confirmArchive ? STATUS_META[confirmArchive.status].label : ""}）。
            {confirmArchive && confirmArchive.status !== "cancelled" && confirmArchive.seats.length > 0 ? (
              <>
                <br />· 顾客<b className="text-[#141414]">无法签到入场</b>
                <br />· 它的 <b className="text-[#141414]">{confirmArchive.seats.length}</b> 个座位
                （{confirmArchive.seats.join("、")}）<b className="text-[#141414]">立即释放</b>，
                可能被别人订走
                <br />· 取消归档时<b className="text-[#141414]">需要重新选座</b>
              </>
            ) : (
              <>
                <br />
                这笔是「已取消」状态，本来就不占座位，归档只是隐藏。
              </>
            )}
          </>
        }
        confirmLabel="归档"
        cancelLabel="返回"
        onConfirm={() => {
          if (!confirmArchive) return;
          const { booking_id, is_archived } = confirmArchive;
          setConfirmArchive(null);
          doArchive(booking_id, !is_archived);
        }}
        onCancel={() => setConfirmArchive(null)}
      />

      <ConfirmDialog
        open={!!confirmCancel}
        danger
        busy={busy}
        title="取消这张订单？"
        description={
          <>
            订单 <b className="text-[#141414]">{confirmCancel}</b> 会作废，它占的座位立即释放。
            记录会保留并显示为「已取消」。
          </>
        }
        confirmLabel="确认取消订单"
        cancelLabel="返回"
        onConfirm={() => confirmCancel && doCancel(confirmCancel)}
        onCancel={() => setConfirmCancel(null)}
      />

      {/* Bulk archive. Paid / payment-traced rows are excluded from the batch
          and reported, never silently included. */}
      <ConfirmDialog
        open={confirmBulkArchive}
        danger={bulkArchivable.length > 0}
        busy={busy}
        title={bulkArchivable.length === 0 ? "这批没有可归档的报名" : `归档 ${bulkArchivable.length} 笔？`}
        description={
          bulkArchivable.length === 0 ? (
            <>
              已选的 {pickedRows.length} 笔<b className="text-[#141414]">全部已收款且尚未取消</b>，
              批量归档会跳过它们（需等批 7b 额度系统上线）。请先取消订单，或单独处理。
            </>
          ) : (
            <>
              将归档 <b className="text-[#141414]">{bulkArchivable.length}</b> 笔。
              {bulkSeatCount > 0 ? (
                <>
                  {" "}其中<b className="text-[#141414]">立即释放 {bulkSeatCount}</b> 个座位
                  （可能被别人订走，取消归档时需要重新选座）。归档后顾客无法签到入场。
                </>
              ) : (
                <> 它们都是「已取消」状态，本来就不占座位，归档只是隐藏。</>
              )}
              {bulkSkipped.length > 0 && (
                <>
                  <br />
                  其中 <b className="text-[#141414]">{bulkSkipped.length}</b> 笔已收款且尚未取消，
                  <b className="text-[#141414]">将被跳过</b>（需等批 7b 额度系统上线）。
                </>
              )}
            </>
          )
        }
        confirmLabel={bulkArchivable.length === 0 ? "我知道了" : "归档"}
        cancelLabel="返回"
        onConfirm={() => {
          setConfirmBulkArchive(false);
          if (bulkArchivable.length > 0) doBulkArchive();
        }}
        onCancel={() => setConfirmBulkArchive(false)}
      />

      {/* Bulk cancel. Nothing is skipped for money reasons — see doBulkCancel —
          so the confirmation has to carry the numbers instead. */}
      <ConfirmDialog
        open={confirmBulkCancel}
        danger
        busy={busy}
        title={bulkCancelTargets.length === 0 ? "这批没有可取消的订单" : `取消 ${bulkCancelTargets.length} 笔订单？`}
        description={
          bulkCancelTargets.length === 0 ? (
            <>已选的 {pickedRows.length} 笔<b className="text-[#141414]">已经全部是「已取消」</b>，无需再处理。</>
          ) : (
            <>
              将取消 <b className="text-[#141414]">{bulkCancelTargets.length}</b> 笔订单，释放{" "}
              <b className="text-[#141414]">{bulkCancelSeats}</b> 个座位。
              {bulkCancelPaid.length > 0 && (
                <>
                  <br />
                  其中 <b className="text-[#141414]">{bulkCancelPaid.length}</b> 笔有收款记录，合计{" "}
                  <b className="text-[#141414]">RM {bulkCancelPaidTotal.toFixed(2)}</b> —— 取消
                  <b className="text-[#141414]">不会退款</b>。
                </>
              )}
              {bulkCancelAlready.length > 0 && (
                <>
                  <br />
                  另有 {bulkCancelAlready.length} 笔已经是「已取消」，不重复处理。
                </>
              )}
              <br />
              已取消的订单很难恢复（座位释放后可能被他人订走）。确定继续？
            </>
          )
        }
        confirmLabel={bulkCancelTargets.length === 0 ? "我知道了" : "确认取消订单"}
        cancelLabel="返回"
        onConfirm={() => {
          setConfirmBulkCancel(false);
          if (bulkCancelTargets.length > 0) doBulkCancel();
        }}
        onCancel={() => setConfirmBulkCancel(false)}
      />

      <ArchiveModal open={archiveOpen} onClose={() => setArchiveOpen(false)} onChanged={load} />
    </div>
  );
}
