import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertCircle, Search, X, Ticket, RefreshCw, Archive, Ban, QrCode, UserPlus, Armchair, CalendarClock } from "lucide-react";
import {
  listBookings,
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
import { QrTicket } from "@/components/offline-event/QrTicket";
import ManualAddModal from "@/components/offline-event/ManualAddModal";
import SeatOpModal from "@/components/offline-event/SeatOpModal";

/**
 * Offline Event admin — P7a bookings management (`/admin/offline-event/bookings`).
 * List / search / filter all bookings, open one for detail (seats, payment,
 * check-in, QR), and cancel (void + free seats) or archive (hide). All through
 * the requireAdmin-gated `offline-event-admin` fn — the frontend never touches
 * the RLS-locked oe_ tables directly.
 */

const STATUS_META: Record<OeBookingStatus, { label: string; cls: string }> = {
  confirmed: { label: "已确认", cls: "bg-emerald-100 text-emerald-700" },
  pending: { label: "待付款", cls: "bg-amber-100 text-amber-700" },
  cancelled: { label: "已取消", cls: "bg-gray-200 text-gray-600" },
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
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState("");

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
    listBookings({ eventId, status, includeArchived, search })
      .then((r) => {
        setRows(r.bookings);
        setTotal(r.total);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "加载失败"));
  }, [eventId, status, includeArchived, search]);

  // Reload on filter changes (search is applied explicitly via the box below).
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, status, includeArchived]);

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

  const doCancel = async (code: string) => {
    if (!window.confirm(`确定取消订单 ${code}？会作废这张票并放开它占的座位（记录会保留、显示为已取消）。`)) return;
    setBusy(true);
    try {
      await cancelBooking(code);
      await openDetail(code);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "取消失败");
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
            <option value="">全部活动</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.display_label}</option>
            ))}
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
          <label className="flex items-center gap-2 text-sm text-muted-foreground px-1">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            含已归档
          </label>
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
          <button onClick={() => { setSearch(""); setEventId(""); setStatus(""); setIncludeArchived(false); }} className="h-10 px-3 rounded-xl bg-muted text-sm text-muted-foreground flex items-center gap-1.5">
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
          <Ticket className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">报名列表</span>
          <span className="text-xs text-muted-foreground ml-auto">共 {total} 条</span>
          <button
            onClick={() => setAddOpen(true)}
            className="h-8 px-3 rounded-lg text-white text-xs font-medium flex items-center gap-1"
            style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
          >
            <UserPlus className="w-3.5 h-3.5" /> 手动加票
          </button>
        </div>
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
                  <th className="px-4 py-2 font-medium">报名码</th>
                  <th className="px-4 py-2 font-medium">邮箱</th>
                  <th className="px-4 py-2 font-medium">活动</th>
                  <th className="px-4 py-2 font-medium">座位</th>
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
                    className={`border-b border-border/30 hover:bg-muted/40 cursor-pointer ${b.is_archived ? "opacity-50" : ""}`}
                    onClick={() => openDetail(b.booking_id)}
                  >
                    <td className="px-4 py-2 font-mono text-xs">{b.booking_id}</td>
                    <td className="px-4 py-2 truncate max-w-[160px]">{b.email || "—"}</td>
                    <td className="px-4 py-2 truncate max-w-[160px]">{b.event_label}</td>
                    <td className="px-4 py-2 tabular-nums">{b.seats.length}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{b.total > 0 ? `RM ${b.total.toFixed(2)}` : "免费"}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${STATUS_META[b.status].cls}`}>
                        {STATUS_META[b.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {b.day1_status === "attended" ? "D1✓" : "D1·"} {b.day2_status === "attended" ? "D2✓" : "D2·"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <QrCode className="w-4 h-4 text-muted-foreground inline" />
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
                      <a href={detail.booking.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Stripe 收据</a>
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
                        onClick={() => doCancel(detail.booking.booking_id)}
                        className="flex-1 h-10 rounded-xl bg-red-50 text-red-700 text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Ban className="w-4 h-4" /> 取消订单
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => doArchive(detail.booking.booking_id, !detail.booking.is_archived)}
                      className="flex-1 h-10 rounded-xl bg-muted text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Archive className="w-4 h-4" /> {detail.booking.is_archived ? "取消归档" : "归档"}
                    </button>
                  </div>
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
    </div>
  );
}
