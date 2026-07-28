import { useEffect, useRef, useState } from "react";
import { Loader2, Search, RefreshCw, ExternalLink, Building2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  listLocations,
  setPlaybookAccess,
  syncLocations,
  getRolloutMode,
  setRolloutMode,
  listPlaybookRoster,
  PLAYBOOK_KEY,
  type AdminLocation,
  type PlaybookRoster,
} from "@/lib/adminApi";

/**
 * Admin god-view (`/admin/sub-accounts`): every GHL sub-account with per-tool
 * access toggles. Legitimate here because it's behind real login + the
 * requireAdmin-gated `admin` edge fn. Never exposed to the customer app.
 */
export default function AdminSubAccounts() {
  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [capped, setCapped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // location_id being saved
  // Platform rollout state: true = 内测中 (whitelist), false = 已全面开放.
  const [whitelistMode, setWhitelistMode] = useState(false);
  const [rolloutBusy, setRolloutBusy] = useState(false);
  const [confirmOpenAll, setConfirmOpenAll] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    getRolloutMode()
      .then((r) => setWhitelistMode(r.whitelistMode))
      .catch(() => {
        /* banner just stays off — never block the page on it */
      });
  }, []);

  const flipRollout = async (nextWhitelist: boolean) => {
    setRolloutBusy(true);
    try {
      await setRolloutMode(nextWhitelist);
      setWhitelistMode(nextWhitelist);
      setConfirmOpenAll(false);
      toast.success(nextWhitelist ? "已改回内测中（只有名单内可用）" : "已全面开放");
      // Every row's effective state is computed server-side against this flag,
      // so the list must be re-read — not patched locally.
      await load(query.trim());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "切换失败");
    } finally {
      setRolloutBusy(false);
    }
  };

  const load = async (q: string) => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const res = await listLocations(q, 50);
      if (mine !== seq.current) return; // a newer search superseded this one
      setLocations(res.locations);
      setTotal(res.total);
      setCapped(res.capped);
      setWhitelistMode(res.whitelistMode);
    } catch (e) {
      if (mine === seq.current) toast.error(e instanceof Error ? e.message : "加载失败");
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  };

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => load(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const toggle = async (loc: AdminLocation, next: boolean) => {
    setBusy(loc.location_id);
    // Optimistic. Writing an explicit row means the answer no longer depends on
    // the rollout flag, so playbook_enabled follows the row directly.
    const patch = (v: boolean) =>
      setLocations((list) =>
        list.map((l) =>
          l.location_id === loc.location_id
            ? { ...l, access: { ...l.access, [PLAYBOOK_KEY]: v }, playbook_enabled: v }
            : l,
        ),
      );
    patch(next);
    try {
      await setPlaybookAccess(loc.location_id, next);
      toast.success(next ? "已开启 Playbook" : "已关闭 Playbook");
    } catch (e) {
      patch(!next);
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(null);
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const n = await syncLocations();
      toast.success(`已从 GHL 同步 ${n} 个 Sub Account`);
      await load(query.trim());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "同步失败");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-display font-bold">Sub Account & 权限</h1>
          <p className="text-sm text-muted-foreground mt-1">
            开/关每个 Sub Account 的 Playbook 使用权限（整个产品，不分工具）
            {total != null ? ` · 共 ${total} 个 Sub Account` : ""}
          </p>
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border border-border/60 hover:border-border disabled:opacity-60"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          从 GHL 同步
        </button>
      </div>

      {/* Rollout state — the launch switch. 内测中 = whitelist (only sub-accounts
          switched on get in); 已全面开放 = everyone except those switched off.
          Flipping it NEVER touches per-sub-account rows, so a deliberately
          closed customer stays closed. Admins pass either way. Black block =
          "not the normal state", consistent with the Stripe-LIVE warning. */}
      <div
        className={`mt-4 rounded-xl border-2 border-[#141414] p-4 flex items-start gap-3 ${
          whitelistMode ? "bg-[#141414]" : "bg-white"
        }`}
      >
        {whitelistMode ? (
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-[#fed50a]" />
        ) : (
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-[#141414]" />
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold ${whitelistMode ? "text-white" : "text-[#141414]"}`}>
            {whitelistMode ? "内测中 · 只有名单内的 Sub Account 能用" : "已全面开放"}
          </p>
          <p className={`text-xs mt-0.5 ${whitelistMode ? "text-white/70" : "text-muted-foreground"}`}>
            {whitelistMode
              ? "名单外的 Sub Account 打开工具会看到「尚未开放」。你（管理员）不受限制。"
              : `所有 Sub Account 都能用，除了被你单独关掉的。以后从 GHL 同步进来的新客户，默认就能用。`}
          </p>
          {/* Who is actually in / out — otherwise the owner has to page through
              911 rows to find out, which is how the test account sat locked out
              without anyone noticing. */}
          <RolloutRoster whitelistMode={whitelistMode} />
        </div>
        <button
          type="button"
          onClick={() => (whitelistMode ? setConfirmOpenAll(true) : flipRollout(true))}
          disabled={rolloutBusy}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold border-2 border-[#141414] disabled:opacity-60 ${
            whitelistMode ? "bg-[#fed50a] text-[#141414]" : "bg-white text-[#141414]"
          }`}
        >
          {rolloutBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {whitelistMode ? "全部开启" : "改回内测"}
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpenAll}
        title="全部开启？"
        description={
          <>
            <b className="text-[#141414]">{total ?? 911} 个 Sub Account</b> 会立刻可以使用 Playbook，
            以后新同步进来的也默认能用。
            <br />
            <span className="text-muted-foreground">
              被你<b className="text-[#141414]">单独关掉</b>的客户不受影响，仍然是关的。随时可以一键「改回内测」。
            </span>
          </>
        }
        confirmLabel="全部开启"
        cancelLabel="再等等"
        onConfirm={() => flipRollout(false)}
        onCancel={() => setConfirmOpenAll(false)}
      />

      <div className="relative mt-4">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 z-10" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索商家名或 location_id…"
          className="glass-input w-full pl-9 pr-3 py-2.5 text-sm"
        />
      </div>

      {loading ? (
        <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground py-10">
          <Loader2 className="w-5 h-5 animate-spin" /> 加载中…
        </div>
      ) : locations.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground py-10 text-center">没有匹配的 Sub Account。</p>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {locations.map((loc) => (
              <div key={loc.location_id} className="glass-card rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white shadow-sm border border-border/40 flex items-center justify-center overflow-hidden shrink-0">
                  {loc.logo_url ? (
                    <img src={loc.logo_url} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{loc.business_name || "(未命名)"}</p>
                  <p className="text-[11px] text-muted-foreground truncate font-mono">{loc.location_id}</p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {/* ONE switch: the Playbook is a single product, not
                      separately-purchasable tools. On = this sub-account can use
                      everything; off = nothing. */}
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <span className="text-xs text-muted-foreground hidden sm:inline">Playbook</span>
                    <Toggle
                      on={loc.playbook_enabled}
                      busy={busy === loc.location_id}
                      onChange={(v) => toggle(loc, v)}
                    />
                  </label>
                  <a
                    href={`/review-boost/location/${loc.location_id}?embed=true`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> 打开
                  </a>
                </div>
              </div>
            ))}
          </div>
          {capped && (
            <p className="mt-3 text-xs text-muted-foreground text-center">只显示前 50 个 · 用搜索找更多</p>
          )}
        </>
      )}
    </div>
  );
}

/** Names the sub-accounts with an explicit row, so the rollout card says WHO is
 *  in the whitelist / WHO stays locked out instead of only how the flag is set. */
function RolloutRoster({ whitelistMode }: { whitelistMode: boolean }) {
  const [roster, setRoster] = useState<PlaybookRoster | null>(null);

  useEffect(() => {
    listPlaybookRoster()
      .then(setRoster)
      .catch(() => {
        /* purely informational — never block the card on it */
      });
  }, [whitelistMode]);

  if (!roster) return null;
  const label = (r: { location_id: string; business_name: string | null }) => r.business_name || r.location_id;
  const tone = whitelistMode ? "text-white/70" : "text-muted-foreground";

  return (
    <div className={`text-xs mt-1.5 space-y-0.5 ${tone}`}>
      {whitelistMode && (
        <p>
          名单内 <b className={whitelistMode ? "text-[#fed50a]" : "text-[#141414]"}>{roster.on.length}</b> 个
          {roster.on.length > 0 && <>：{roster.on.map(label).join("、")}</>}
        </p>
      )}
      {roster.off.length > 0 && (
        <p>
          另有 <b className={whitelistMode ? "text-[#fed50a]" : "text-[#141414]"}>{roster.off.length}</b> 个被单独关闭：
          {roster.off.map(label).join("、")}
          {!whitelistMode && "（全部开启不会把它们打开）"}
        </p>
      )}
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
