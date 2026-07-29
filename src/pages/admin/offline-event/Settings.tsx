import { useEffect, useRef, useState } from "react";
import {
  Loader2, AlertCircle, CreditCard, ShieldCheck, ShieldAlert, Save, Check, Search,
  Trash2, RefreshCw, Building2, ChevronLeft, ChevronRight, Undo2,
} from "lucide-react";
import {
  getSettings,
  updateSettings,
  setStripeMode,
  updateSubaccountSettings,
  deleteSubaccountSettings,
  listSubaccounts,
  setOeAccess,
  OE_STRIPE_MODE_EVENT,
  type OeSettingsResponse,
  type OeStripeMode,
  type OeSubaccountManagerRow,
  type OeSubaccountPage,
} from "@/lib/offlineEventAdmin";
import { syncLocations } from "@/lib/adminApi";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";

/**
 * Offline Event admin — P7c settings (`/admin/offline-event/settings`).
 * SST rate, lunch price, max seats, free-allowance default + per-sub-account
 * overrides, and the Stripe test/live mode switch (the money switch — three
 * safeguards: live-key precheck, typed confirmation, pending warning + a
 * prominent current-mode badge). Every write goes through requireAdmin; the
 * mode switch is audited.
 */

const LIVE_CONFIRM = "正式";

export default function OfflineEventSettings() {
  const [resp, setResp] = useState<OeSettingsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Bumped after the global defaults are saved, so the sub-account table
  // re-reads (rows with no override display the default inline).
  const [reloadToken, setReloadToken] = useState(0);

  // charge settings form
  const [sstPercent, setSstPercent] = useState("");
  const [lunchPrice, setLunchPrice] = useState("");
  const [maxSeats, setMaxSeats] = useState("");
  const [defTickets, setDefTickets] = useState("");
  const [defSeats, setDefSeats] = useState("");
  const [savedFlag, setSavedFlag] = useState(false);
  const [saving, setSaving] = useState(false);

  // stripe switch
  const [confirmText, setConfirmText] = useState("");
  const [switching, setSwitching] = useState(false);
  const [confirmSandbox, setConfirmSandbox] = useState(false);
  const [switchErr, setSwitchErr] = useState<string | null>(null);

  const load = () => {
    setErr(null);
    getSettings()
      .then((r) => {
        setResp(r);
        setSstPercent(String(Math.round(Number(r.settings.sst_rate) * 10000) / 100));
        setLunchPrice(r.settings.lunch_price);
        setMaxSeats(r.settings.max_seats_per_booking);
        setDefTickets(r.settings.default_free_tickets);
        setDefSeats(r.settings.default_free_seats);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "加载失败"));
  };
  useEffect(load, []);

  const saveCharges = async () => {
    // An empty SST box must never reach the server. `Number("")` is 0, so a blank
    // field submitted a perfectly valid "0%" — from that moment every order stops
    // collecting tax, and the page answers with a 已保存 tick. Nobody writes in to
    // report being under-charged, so this is a mistake that never surfaces on its
    // own. Blank and 0% are different answers: a tax-free event says 0 out loud.
    //
    // This guard is the PRIMARY one. The server cannot cover this case on its own —
    // by the time the request leaves here the blank has already become the number
    // 0, and 0 is indistinguishable from a deliberate 0. Its matching check is for
    // any other caller that sends the field blank.
    if (sstPercent.trim() === "") {
      toast.error("税率不能为空 —— 免税活动请明确输入 0");
      return;
    }
    setSaving(true);
    setSavedFlag(false);
    try {
      await updateSettings({
        sst_rate: Number(sstPercent) / 100,
        lunch_price: lunchPrice,
        max_seats_per_booking: maxSeats,
        default_free_tickets: defTickets,
        default_free_seats: defSeats,
      });
      setSavedFlag(true);
      setTimeout(() => setSavedFlag(false), 2500);
      load();
      setReloadToken((n) => n + 1); // rows showing "全局默认" must pick up the new numbers
    } catch (e) {
      // `err` only renders in the !resp full-page state (see below), so on a loaded
      // page a failed save used to show NOTHING — the button just stopped. Same
      // silent-failure class as the SST bug above, so it gets a toast too.
      const msg = e instanceof Error ? e.message : "保存失败";
      setErr(msg);
      toast.error(msg === "sst_rate_required" ? "税率不能为空 —— 免税活动请明确输入 0" : `保存失败：${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const doSwitch = async (mode: OeStripeMode) => {
    setSwitching(true);
    setSwitchErr(null);
    try {
      await setStripeMode(mode);
      setConfirmText("");
      load();
      // Tell the always-on badge in the shell to re-read NOW. The shell is a
      // layout route and doesn't remount on this action, so without this the
      // money-mode badge would keep showing the previous mode until a reload.
      window.dispatchEvent(new Event(OE_STRIPE_MODE_EVENT));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "切换失败";
      setSwitchErr(msg === "live_key_missing" ? "正式密钥未配置，无法切换。" : msg);
    } finally {
      setSwitching(false);
    }
  };

  if (err && !resp) {
    return (
      <div className="glass-card rounded-2xl p-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div><p className="font-medium text-sm">加载失败</p><p className="text-sm text-muted-foreground mt-0.5">{err}</p></div>
      </div>
    );
  }
  if (!resp) {
    return <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  const isLive = resp.settings.stripe_payment_mode === "live";

  return (
    <div className="space-y-5 max-w-2xl">
      {/* ── Stripe mode (the money switch) ── */}
      {/* Money switch — LIVE = strong BLACK danger card + yellow; TEST = yellow-tint safe.
          (Brutalist: danger read by black weight + ShieldAlert + explicit wording, not red.) */}
      <div className={`rounded-2xl p-5 border-2 ${isLive ? "border-[#141414] bg-white" : "border-[#141414]/30 bg-white"}`}>
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="w-5 h-5 text-[#141414]" />
          <p className="font-display font-bold">Stripe 付款模式</p>
        </div>

        <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${isLive ? "bg-[#141414]" : "bg-[#fed50a]/25"}`}>
          {isLive ? <ShieldAlert className="w-6 h-6 text-[#fed50a] shrink-0" /> : <ShieldCheck className="w-6 h-6 text-[#141414] shrink-0" />}
          <div>
            <p className={`font-bold ${isLive ? "text-[#fed50a]" : "text-[#141414]"}`}>
              当前：{isLive ? "正式模式 (Live) · 真实扣款，请谨慎" : "测试模式 (Sandbox) · 不扣真钱"}
            </p>
            <p className={`text-xs ${isLive ? "text-[#fed50a]/85" : "text-[#141414]"}`}>
              {isLive ? "顾客下单会真实扣款到你的 Stripe 账户。" : "顾客下单用测试卡（4242…），不会真实扣款。"}
            </p>
          </div>
        </div>

        {!isLive ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">切换到正式模式（开始收真钱）</p>
            {/* Safeguard 1: live key precheck */}
            <div className="text-xs flex items-center gap-1.5 text-[#141414]">
              {resp.liveKeyConfigured ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              平台正式密钥（Stripe Live，平台各工具共用）：{resp.liveKeyConfigured ? "已配置" : "未配置（请先在 Supabase 配好，否则无法切换）"}
            </div>
            {/* Safeguard 3: pending warning */}
            {resp.pendingCount > 0 && (
              <div className="text-xs text-[#141414] flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> 有 {resp.pendingCount} 个待付款订单在进行中，切换前建议先处理（否则它们可能核实失败）。
              </div>
            )}
            {/* Safeguard 2: typed confirmation */}
            <div className="flex gap-2 items-center pt-1">
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={`输入「${LIVE_CONFIRM}」确认`}
                disabled={!resp.liveKeyConfigured}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm w-48 disabled:opacity-50"
              />
              <button
                onClick={() => doSwitch("live")}
                disabled={!resp.liveKeyConfigured || confirmText.trim() !== LIVE_CONFIRM || switching}
                className="h-10 px-4 rounded-xl bg-[#141414] text-[#fed50a] text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40"
              >
                {switching ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                切换到正式模式
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            {/* In-app confirmation, NOT window.confirm(): a suppressed native
                dialog returns false, which silently skipped the switch — you'd
                think you were back in Sandbox while still charging real cards. */}
            <button
              onClick={() => setConfirmSandbox(true)}
              disabled={switching}
              className="h-10 px-4 rounded-xl bg-muted text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
            >
              {switching ? <Loader2 className="w-4 h-4 animate-spin" /> : null} 切回测试模式 (Sandbox)
            </button>
          </div>
        )}
        {switchErr && <p className="text-sm text-destructive mt-2">{switchErr}</p>}
      </div>

      {confirmSandbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => !switching && setConfirmSandbox(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white border-2 border-[#141414] p-5"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#141414] flex items-center justify-center text-[#fed50a] shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-display font-bold">切回测试模式？</p>
                <p className="text-sm text-muted-foreground mt-1">
                  之后顾客下单将使用测试卡，<b className="text-[#141414]">不再真实扣款</b>。已完成的真实订单不受影响。
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setConfirmSandbox(false)}
                disabled={switching}
                className="flex-1 h-10 rounded-xl border-2 border-[#141414] bg-white text-sm font-medium disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={async () => {
                  await doSwitch("sandbox");
                  setConfirmSandbox(false);
                }}
                disabled={switching}
                className="flex-1 h-10 rounded-xl bg-[#141414] text-[#fed50a] text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {switching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                确认切回测试
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Charge settings ── */}
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <p className="font-display font-bold">收费设置</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="SST 税率 %"><input value={sstPercent} onChange={(e) => setSstPercent(e.target.value)} inputMode="decimal" className={inp} /></Field>
          <Field label="午餐价 RM/份"><input value={lunchPrice} onChange={(e) => setLunchPrice(e.target.value)} inputMode="decimal" className={inp} /></Field>
          <Field label="每单最多座位"><input value={maxSeats} onChange={(e) => setMaxSeats(e.target.value)} inputMode="numeric" className={inp} /></Field>
        </div>
        <p className="font-medium text-sm pt-1">免费额度（全局默认，新子账号首次访问时套用）</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="默认免费票（张）"><input value={defTickets} onChange={(e) => setDefTickets(e.target.value)} inputMode="numeric" className={inp} /></Field>
          <Field label="默认免费座位（个）"><input value={defSeats} onChange={(e) => setDefSeats(e.target.value)} inputMode="numeric" className={inp} /></Field>
        </div>
        <button onClick={saveCharges} disabled={saving} className="h-10 px-5 rounded-xl text-[#141414] text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40" style={{ background: "#fed50a" }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : savedFlag ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {savedFlag ? "已保存" : "保存"}
        </button>
      </div>

      {/* ── Sub-account manager: ALL sub-accounts, allowance + booking switch ── */}
      <SubAccountManager reloadToken={reloadToken} />
    </div>
  );
}

/**
 * The sub-account manager — EVERY sub-account (not only the ones that already
 * opened the tool), server-paged and server-searched, with per-row free
 * allowance + the offline-class booking switch.
 *
 * Deliberately server-side: at 911 sub-accounts, loading them all to filter in
 * the browser makes search lie (it would only match the loaded slice) and the
 * old one-shot name lookup already broke silently at that size.
 */
const PAGE_SIZE = 50;

function SubAccountManager({ reloadToken }: { reloadToken: number }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OeSubaccountPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [confirmReset, setConfirmReset] = useState<OeSubaccountManagerRow | null>(null);
  // Guards against a slow earlier request landing after a newer one.
  const seq = useRef(0);

  const load = async (q: string, p: number) => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const res = await listSubaccounts({ query: q, page: p, pageSize: PAGE_SIZE });
      if (mine !== seq.current) return;
      setData(res);
    } catch (e) {
      if (mine === seq.current) toast.error(e instanceof Error ? e.message : "加载失败");
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  };

  // Debounced search; any new search restarts at page 1.
  useEffect(() => {
    const t = setTimeout(() => load(query.trim(), page), 300);
    return () => clearTimeout(t);
  }, [query, page, reloadToken]);

  const refresh = () => load(query.trim(), page);

  const saveAllowance = async (row: OeSubaccountManagerRow, ft: number, fs: number) => {
    try {
      await updateSubaccountSettings(row.location_id, ft, fs);
      toast.success(`已保存「${row.business_name || row.location_id}」：${ft} 票 / ${fs} 座`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    }
  };

  const resetAllowance = async (row: OeSubaccountManagerRow) => {
    try {
      await deleteSubaccountSettings(row.location_id);
      setConfirmReset(null);
      toast.success(`「${row.business_name || row.location_id}」已回到全局默认额度`);
      refresh();
    } catch (e) {
      setConfirmReset(null);
      toast.error(e instanceof Error ? e.message : "操作失败");
    }
  };

  const toggleOe = async (row: OeSubaccountManagerRow, next: boolean) => {
    // Optimistic: the switch must feel instant; a failure reverts + tells why.
    setData((d) => d && { ...d, rows: d.rows.map((r) => (r.location_id === row.location_id ? { ...r, oe_enabled: next } : r)) });
    try {
      await setOeAccess(row.location_id, next);
      toast.success(next ? `已允许「${row.business_name || row.location_id}」报名线下课` : `已停止「${row.business_name || row.location_id}」报名线下课`);
    } catch (e) {
      setData((d) => d && { ...d, rows: d.rows.map((r) => (r.location_id === row.location_id ? { ...r, oe_enabled: !next } : r)) });
      toast.error(e instanceof Error ? e.message : "保存失败");
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const n = await syncLocations();
      toast.success(`已从 GHL 同步 ${n} 个子账号`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "同步失败");
    } finally {
      setSyncing(false);
    }
  };

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const defaults = data?.defaults ?? { free_tickets: 0, free_seats: 0 };
  // Label the page the ROWS came from, not the page we asked for — while a
  // fetch is in flight those differ, and a label that reads "第 3 页" above
  // page 2's rows makes paging look broken.
  const shownPage = data?.page ?? page;

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-display font-bold">子账号管理{total ? ` · 共 ${total} 个` : ""}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            每个客户的免费额度 + 能否报名线下课。没设过额度的显示「全局默认（{defaults.free_tickets} 票 / {defaults.free_seats} 座）」，一保存就成为它的专属额度。
          </p>
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border border-border/60 hover:border-border disabled:opacity-60 shrink-0"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          从 GHL 同步
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground mt-2">
        「线下课」开关独立于 Playbook 总开关 —— <b className="text-[#141414]">两个都开</b>才能报名。总开关要去「Sub Account & 权限」页改。
      </p>

      <div className="relative mt-3">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 z-10" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="搜索商家名或 location_id…（搜全部 911 个，不只当前页）"
          className="glass-input w-full pl-9 pr-3 py-2.5 text-sm"
        />
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 text-muted-foreground py-10">
          <Loader2 className="w-5 h-5 animate-spin" /> 加载中…
        </div>
      ) : !data || data.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">没有匹配的子账号。</p>
      ) : (
        <>
          <div className={`mt-3 ${loading ? "opacity-50" : ""}`}>
            {data.rows.map((row) => (
              <SubRow
                key={row.location_id}
                row={row}
                defaults={defaults}
                onSaveAllowance={saveAllowance}
                onResetAllowance={setConfirmReset}
                onToggleOe={toggleOe}
              />
            ))}
          </div>

          <div className="flex items-center justify-center gap-3 mt-4 text-sm">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="h-9 px-3 rounded-lg border border-border/60 inline-flex items-center gap-1 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" /> 上一页
            </button>
            <span className="text-muted-foreground">
              第 {shownPage} / {totalPages} 页
              {loading && <Loader2 className="w-3 h-3 animate-spin inline ml-1.5 -mt-0.5" />}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="h-9 px-3 rounded-lg border border-border/60 inline-flex items-center gap-1 disabled:opacity-30"
            >
              下一页 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!confirmReset}
        title="回到全局默认额度？"
        description={
          <>
            「<b className="text-[#141414]">{confirmReset?.business_name || confirmReset?.location_id}</b>」
            的专属额度会被清除，改为跟随<b className="text-[#141414]">全局默认（{defaults.free_tickets} 票 / {defaults.free_seats} 座）</b>。
          </>
        }
        confirmLabel="回到默认"
        cancelLabel="返回"
        onConfirm={() => confirmReset && resetAllowance(confirmReset)}
        onCancel={() => setConfirmReset(null)}
      />
    </div>
  );
}

/** One sub-account row: allowance inputs + the offline-class booking switch. */
function SubRow({
  row,
  defaults,
  onSaveAllowance,
  onResetAllowance,
  onToggleOe,
}: {
  row: OeSubaccountManagerRow;
  defaults: { free_tickets: number; free_seats: number };
  onSaveAllowance: (row: OeSubaccountManagerRow, ft: number, fs: number) => Promise<void>;
  onResetAllowance: (row: OeSubaccountManagerRow) => void;
  onToggleOe: (row: OeSubaccountManagerRow, next: boolean) => Promise<void>;
}) {
  // What the row currently GRANTS: its own override, or the inherited default.
  const effFt = row.has_override ? row.free_tickets ?? 0 : defaults.free_tickets;
  const effFs = row.has_override ? row.free_seats ?? 0 : defaults.free_seats;
  const [ft, setFt] = useState(String(effFt));
  const [fs, setFs] = useState(String(effFs));
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  // A reload (search / page / refresh) hands back new numbers — re-sync the
  // inputs, or the row would keep showing the previous account's edits.
  useEffect(() => {
    setFt(String(effFt));
    setFs(String(effFs));
  }, [effFt, effFs, row.location_id]);

  const dirty = ft !== String(effFt) || fs !== String(effFs);

  const save = async () => {
    setSaving(true);
    try {
      await onSaveAllowance(row, Math.max(0, Math.floor(Number(ft) || 0)), Math.max(0, Math.floor(Number(fs) || 0)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm border-b border-border/30 py-2 flex-wrap sm:flex-nowrap">
      <div className="w-8 h-8 rounded-lg bg-white border border-border/40 flex items-center justify-center overflow-hidden shrink-0">
        {row.logo_url ? <img src={row.logo_url} alt="" className="w-full h-full object-contain" /> : <Building2 className="w-4 h-4 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{row.business_name || "(未命名)"}</p>
        <p className="text-[11px] text-muted-foreground truncate font-mono">{row.location_id}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {!row.has_override && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">全局默认</span>
          )}
          {/* Master switch is read-only here: when it's off the booking switch
              below cannot help, so say so instead of letting it look broken. */}
          {!row.playbook_enabled && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#141414] text-[#fed50a]">Playbook 已关</span>
          )}
        </div>
      </div>

      <label className="text-[11px] text-muted-foreground shrink-0">票
        <input value={ft} onChange={(e) => setFt(e.target.value)} inputMode="numeric" className="ml-1 w-12 h-8 rounded-lg border border-border bg-background px-2 text-sm" />
      </label>
      <label className="text-[11px] text-muted-foreground shrink-0">座
        <input value={fs} onChange={(e) => setFs(e.target.value)} inputMode="numeric" className="ml-1 w-12 h-8 rounded-lg border border-border bg-background px-2 text-sm" />
      </label>
      <button
        onClick={save}
        disabled={!dirty || saving}
        className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-30 shrink-0 inline-flex items-center gap-1"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null} 保存
      </button>
      <button
        onClick={() => onResetAllowance(row)}
        disabled={!row.has_override}
        title="清除覆盖，回到全局默认"
        className="h-8 w-8 rounded-lg text-[#141414] hover:bg-[#141414]/[0.06] flex items-center justify-center disabled:opacity-25 shrink-0"
      >
        <Undo2 className="w-3.5 h-3.5" />
      </button>

      <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0 pl-2">
        <span className="text-[11px] text-muted-foreground hidden lg:inline">线下课</span>
        <Toggle
          on={row.oe_enabled}
          busy={toggling}
          onChange={async (v) => {
            setToggling(true);
            try {
              await onToggleOe(row, v);
            } finally {
              setToggling(false);
            }
          }}
        />
      </label>
    </div>
  );
}

function Toggle({ on, busy, onChange }: { on: boolean; busy: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => !busy && onChange(!on)}
      disabled={busy}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${on ? "bg-primary" : "bg-muted"} disabled:opacity-60`}
      aria-pressed={on}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`}>
        {busy && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground m-0.5" />}
      </span>
    </button>
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
