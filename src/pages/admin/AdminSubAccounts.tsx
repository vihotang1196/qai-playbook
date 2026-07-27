import { useEffect, useRef, useState } from "react";
import { Loader2, Search, RefreshCw, ExternalLink, Building2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  listLocations,
  setPlaybookAccess,
  syncLocations,
  isPlaybookEnabled,
  getCanaryMode,
  setCanaryMode,
  PLAYBOOK_KEY,
  type AdminLocation,
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
  const [busy, setBusy] = useState<string | null>(null); // `${location_id}:${tool}` being saved
  // Canary (whitelist) rollout mode — platform-wide. Drives BOTH the banner and
  // how a "never set" toggle must be shown (see isToolEnabled).
  const [canary, setCanary] = useState(false);
  const [canaryBusy, setCanaryBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    getCanaryMode()
      .then((r) => setCanary(r.enabled))
      .catch(() => {
        /* banner just stays off — never block the page on it */
      });
  }, []);

  const flipCanary = async (next: boolean) => {
    setCanaryBusy(true);
    try {
      await setCanaryMode(next);
      setCanary(next);
      toast.success(next ? "已开启灰度模式（白名单）" : "已关闭灰度模式（全面开放）");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "切换失败");
    } finally {
      setCanaryBusy(false);
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
    // optimistic
    setLocations((list) =>
      list.map((l) =>
        l.location_id === loc.location_id ? { ...l, access: { ...l.access, [PLAYBOOK_KEY]: next } } : l,
      ),
    );
    try {
      await setPlaybookAccess(loc.location_id, next);
      toast.success(next ? "已开启 Playbook" : "已关闭 Playbook");
    } catch (e) {
      // revert
      setLocations((list) =>
        list.map((l) =>
          l.location_id === loc.location_id ? { ...l, access: { ...l.access, [PLAYBOOK_KEY]: !next } } : l,
        ),
      );
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

      {/* Canary rollout switch. ON = whitelist (only sub-accounts toggled on can
          use the tools); OFF = normal (everyone except those toggled off).
          Admins always get through either way. Black block = "this is not the
          normal state", consistent with the Stripe-LIVE warning. */}
      <div
        className={`mt-4 rounded-xl border-2 border-[#141414] p-4 flex items-start gap-3 ${
          canary ? "bg-[#141414]" : "bg-white"
        }`}
      >
        <ShieldAlert className={`w-5 h-5 shrink-0 mt-0.5 ${canary ? "text-[#fed50a]" : "text-[#141414]"}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold ${canary ? "text-white" : "text-[#141414]"}`}>
            {canary ? "灰度模式 · 白名单生效中" : "全面开放中"}
          </p>
          <p className={`text-xs mt-0.5 ${canary ? "text-white/70" : "text-muted-foreground"}`}>
            {canary
              ? "只有下面明确开启的 Sub Account 能使用工具，其他人会看到「正在灰度测试」提示。你（管理员）不受限制。"
              : "所有 Sub Account 都能使用工具，除了被明确关闭的。开启灰度模式后改为「只有开启的能用」。"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => flipCanary(!canary)}
          disabled={canaryBusy}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold border-2 border-[#141414] disabled:opacity-60 ${
            canary ? "bg-[#fed50a] text-[#141414]" : "bg-white text-[#141414]"
          }`}
        >
          {canaryBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {canary ? "关闭灰度 · 全面开放" : "开启灰度模式"}
        </button>
      </div>

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
                      on={isPlaybookEnabled(loc, canary)}
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
