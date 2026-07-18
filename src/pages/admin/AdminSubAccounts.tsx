import { useEffect, useRef, useState } from "react";
import { Loader2, Search, RefreshCw, ExternalLink, Building2 } from "lucide-react";
import { toast } from "sonner";
import { ADMIN_TOOLS, type ToolKey } from "@/lib/admin/tools";
import {
  listLocations,
  setToolAccess,
  syncLocations,
  isToolEnabled,
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
  const seq = useRef(0);

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

  const toggle = async (loc: AdminLocation, tool: ToolKey, next: boolean) => {
    const key = `${loc.location_id}:${tool}`;
    setBusy(key);
    // optimistic
    setLocations((list) =>
      list.map((l) => (l.location_id === loc.location_id ? { ...l, access: { ...l.access, [tool]: next } } : l)),
    );
    try {
      await setToolAccess(loc.location_id, tool, next);
      toast.success(next ? "已开启" : "已关闭");
    } catch (e) {
      // revert
      setLocations((list) =>
        list.map((l) => (l.location_id === loc.location_id ? { ...l, access: { ...l.access, [tool]: !next } } : l)),
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
            开/关每个 Sub Account 每个工具的权限{total != null ? ` · 共 ${total} 个 Sub Account` : ""}
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
                  {ADMIN_TOOLS.map((t) =>
                    t.live ? (
                      <label key={t.key} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <span className="text-xs text-muted-foreground hidden sm:inline">{t.name.cn}</span>
                        <Toggle
                          on={isToolEnabled(loc, t.key)}
                          busy={busy === `${loc.location_id}:${t.key}`}
                          onChange={(v) => toggle(loc, t.key, v)}
                        />
                      </label>
                    ) : (
                      <span key={t.key} className="text-[11px] text-muted-foreground/50 hidden md:inline">
                        {t.name.cn} · 即将
                      </span>
                    ),
                  )}
                  <a
                    href={`/review-boost/location/${loc.location_id}?embed=true`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
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
