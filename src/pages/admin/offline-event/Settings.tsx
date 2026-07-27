import { useEffect, useState } from "react";
import { Loader2, AlertCircle, CreditCard, ShieldCheck, ShieldAlert, Save, Check, Search } from "lucide-react";
import {
  getSettings,
  updateSettings,
  setStripeMode,
  listSubaccountSettings,
  updateSubaccountSettings,
  deleteSubaccountSettings,
  listLocations,
  type OeSettingsResponse,
  type OeStripeMode,
  type OeSubaccountRow,
} from "@/lib/offlineEventAdmin";
import { Trash2 } from "lucide-react";

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
  const [subs, setSubs] = useState<OeSubaccountRow[]>([]);
  const [locNames, setLocNames] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

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
  const [switchErr, setSwitchErr] = useState<string | null>(null);

  const load = () => {
    setErr(null);
    Promise.all([getSettings(), listSubaccountSettings()])
      .then(([r, s]) => {
        setResp(r);
        setSubs(s);
        setSstPercent(String(Math.round(Number(r.settings.sst_rate) * 10000) / 100));
        setLunchPrice(r.settings.lunch_price);
        setMaxSeats(r.settings.max_seats_per_booking);
        setDefTickets(r.settings.default_free_tickets);
        setDefSeats(r.settings.default_free_seats);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "加载失败"));
  };
  useEffect(load, []);

  // Best-effort sub-account name map (so the location_id lookup can show which
  // business it is). Loaded once; failure is non-fatal — the lookup still works.
  useEffect(() => {
    listLocations()
      .then((locs) => {
        const m: Record<string, string> = {};
        for (const l of locs) if (l.business_name) m[l.location_id] = l.business_name;
        setLocNames(m);
      })
      .catch(() => {
        /* names are optional */
      });
  }, []);

  const saveCharges = async () => {
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
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : "切换失败";
      setSwitchErr(msg === "live_key_missing" ? "正式密钥未配置，无法切换。" : msg);
    } finally {
      setSwitching(false);
    }
  };

  // Upsert one sub-account's free allowance (works for any location_id, even one
  // without an existing override row — the backend action upserts). Shared by the
  // overrides list and the location_id lookup.
  const saveAllowance = async (locationId: string, ft: number, fs: number) => {
    await updateSubaccountSettings(locationId, ft, fs);
    load();
  };

  const saveSub = async (row: OeSubaccountRow, ft: number, fs: number) => {
    try {
      await saveAllowance(row.location_id, ft, fs);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
    }
  };

  const delSub = async (row: OeSubaccountRow) => {
    if (!window.confirm(`删除「${row.business_name || row.location_id}」的免费额度覆盖？该子账号将回到全局默认。`)) return;
    try {
      await deleteSubaccountSettings(row.location_id);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "删除失败");
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
            <button
              onClick={() => { if (window.confirm("切回测试模式？之后的下单将不再真实扣款。")) doSwitch("sandbox"); }}
              disabled={switching}
              className="h-10 px-4 rounded-xl bg-muted text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
            >
              {switching ? <Loader2 className="w-4 h-4 animate-spin" /> : null} 切回测试模式 (Sandbox)
            </button>
          </div>
        )}
        {switchErr && <p className="text-sm text-destructive mt-2">{switchErr}</p>}
      </div>

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

      {/* ── Look up / adjust ANY sub-account by location_id ── */}
      <SubAccountLookup
        defaults={{ tickets: resp.settings.default_free_tickets, seats: resp.settings.default_free_seats }}
        overrides={subs}
        nameFor={(id) => locNames[id] ?? null}
        onSave={saveAllowance}
      />

      {/* ── Per-sub-account free allowance overrides ── */}
      <div className="glass-card rounded-2xl p-5">
        <p className="font-display font-bold mb-1">各子账号免费额度（覆盖全局默认）</p>
        <p className="text-xs text-muted-foreground mb-3">只列出已使用过本工具的子账号；改这里会覆盖该客户的免费额度。</p>
        {subs.length === 0 ? (
          <p className="text-sm text-muted-foreground">还没有子账号使用过。</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {subs.map((row) => <SubRow key={row.location_id} row={row} onSave={saveSub} onDelete={delSub} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Look up any sub-account by location_id and adjust its free allowance. Works
 * even for a location_id with no override row yet (shows the global default;
 * saving upserts a per-account override). Reads the already-loaded overrides +
 * name map — no extra backend action.
 */
function SubAccountLookup({
  defaults,
  overrides,
  nameFor,
  onSave,
}: {
  defaults: { tickets: string; seats: string };
  overrides: OeSubaccountRow[];
  nameFor: (id: string) => string | null;
  onSave: (locationId: string, ft: number, fs: number) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<
    | null
    | { locationId: string; name: string | null; hasOverride: boolean; ft: string; fs: string }
  >(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doFind = () => {
    const id = q.trim();
    setSaved(false);
    setError(null);
    if (!id) {
      setFound(null);
      return;
    }
    const ov = overrides.find((r) => r.location_id === id);
    setFound({
      locationId: id,
      name: ov?.business_name ?? nameFor(id),
      hasOverride: !!ov,
      ft: String(ov ? ov.free_tickets : defaults.tickets),
      fs: String(ov ? ov.free_seats : defaults.seats),
    });
  };

  const doSave = async () => {
    if (!found) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const ft = Math.max(0, Math.floor(Number(found.ft) || 0));
      const fs = Math.max(0, Math.floor(Number(found.fs) || 0));
      await onSave(found.locationId, ft, fs);
      setFound({ ...found, hasOverride: true, ft: String(ft), fs: String(fs) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5">
      <p className="font-display font-bold mb-1">按 location_id 查找 / 调整额度</p>
      <p className="text-xs text-muted-foreground mb-3">输入某个子账号的 location_id，查看并调整它的免费额度（没设过覆盖的也能直接设）。</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doFind()}
            placeholder="输入 location_id…"
            className="w-full h-10 rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-mono"
          />
        </div>
        <button onClick={doFind} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5">
          <Search className="w-4 h-4" /> 查找
        </button>
      </div>

      {found && (
        <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
          <div>
            <p className="font-medium text-sm">{found.name || "（未知名称）"}</p>
            <p className="text-[11px] text-muted-foreground font-mono break-all">{found.locationId}</p>
            <p className={`text-xs mt-1 ${found.hasOverride ? "text-foreground" : "text-muted-foreground"}`}>
              {found.hasOverride
                ? "已设覆盖额度"
                : `当前使用全局默认（${defaults.tickets} 票 / ${defaults.seats} 座），保存后为它单独设定`}
            </p>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <label className="text-[11px] text-muted-foreground">
              免费票（张）
              <input value={found.ft} onChange={(e) => setFound({ ...found, ft: e.target.value })} inputMode="numeric" className="mt-1 block w-20 h-9 rounded-lg border border-border bg-background px-2 text-sm" />
            </label>
            <label className="text-[11px] text-muted-foreground">
              免费座位（个）
              <input value={found.fs} onChange={(e) => setFound({ ...found, fs: e.target.value })} inputMode="numeric" className="mt-1 block w-20 h-9 rounded-lg border border-border bg-background px-2 text-sm" />
            </label>
            <button onClick={doSave} disabled={saving} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5 disabled:opacity-40">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? "已保存" : "保存"}
            </button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}

function SubRow({ row, onSave, onDelete }: { row: OeSubaccountRow; onSave: (row: OeSubaccountRow, ft: number, fs: number) => void; onDelete: (row: OeSubaccountRow) => void }) {
  const [ft, setFt] = useState(String(row.free_tickets));
  const [fs, setFs] = useState(String(row.free_seats));
  const dirty = ft !== String(row.free_tickets) || fs !== String(row.free_seats);
  return (
    <div className="flex items-center gap-2 text-sm border-b border-border/30 pb-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{row.business_name || row.location_id}</p>
        <p className="text-[11px] text-muted-foreground truncate">{row.location_id}</p>
      </div>
      <label className="text-[11px] text-muted-foreground">票<input value={ft} onChange={(e) => setFt(e.target.value)} inputMode="numeric" className="ml-1 w-12 h-8 rounded-lg border border-border bg-background px-2 text-sm" /></label>
      <label className="text-[11px] text-muted-foreground">座<input value={fs} onChange={(e) => setFs(e.target.value)} inputMode="numeric" className="ml-1 w-12 h-8 rounded-lg border border-border bg-background px-2 text-sm" /></label>
      <button
        onClick={() => onSave(row, Math.max(0, Math.floor(Number(ft) || 0)), Math.max(0, Math.floor(Number(fs) || 0)))}
        disabled={!dirty}
        className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-30"
      >
        保存
      </button>
      <button onClick={() => onDelete(row)} className="h-8 w-8 rounded-lg text-[#141414] hover:bg-[#141414]/[0.06] flex items-center justify-center" title="删除覆盖">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
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
