import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Building2, ArrowRight, Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useLang } from "@/i18n/LanguageContext";
import { listLocations, setLocationEnabled, syncLocations, type GhlLocation } from "@/lib/ghl";

/**
 * Sub-accounts page (`/review-boost/sub-accounts`) — the agency view.
 * Lists GHL sub-accounts synced into ghl_locations, lets the agency
 * enable/disable each, and opens one into its own admin (= the picker).
 * Renders inside the AdminShell (agency mode).
 */
export default function SubAccounts() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<GhlLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setLocations(await listLocations());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sub-accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { total } = await syncLocations();
      toast.success(lang === "cn" ? `已从 GHL 同步 ${total} 个子账号` : `Synced ${total} sub-accounts from GHL`);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      toast.error(msg);
      setError(msg);
    } finally {
      setSyncing(false);
    }
  };

  const toggle = async (loc: GhlLocation, enabled: boolean) => {
    setLocations((prev) => prev.map((l) => (l.location_id === loc.location_id ? { ...l, is_enabled: enabled } : l)));
    try {
      await setLocationEnabled(loc.location_id, enabled);
    } catch (e) {
      // revert on failure
      setLocations((prev) => prev.map((l) => (l.location_id === loc.location_id ? { ...l, is_enabled: !enabled } : l)));
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold">{lang === "cn" ? "子账号" : "Sub-accounts"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "cn" ? "从 GoHighLevel 同步的子账号，选一个进入它的后台。" : "Sub-accounts synced from GoHighLevel — open one to manage it."}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-95 disabled:opacity-70 shadow-sm"
          style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? (lang === "cn" ? "同步中…" : "Syncing…") : (lang === "cn" ? "从 GHL 同步" : "Sync from GHL")}
        </button>
      </div>

      {error && (
        <div className="glass-card rounded-2xl px-5 py-4 text-sm text-rose-600 break-words">
          {error}
        </div>
      )}

      {loading ? (
        <div className="glass-card rounded-2xl px-5 py-8 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> {lang === "cn" ? "加载中…" : "Loading…"}
        </div>
      ) : locations.length === 0 ? (
        <div className="glass-card rounded-2xl px-5 py-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3">
            <Store className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="font-medium">{lang === "cn" ? "还没有子账号" : "No sub-accounts yet"}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "cn" ? "点上面「从 GHL 同步」拉取你的 GoHighLevel 子账号。" : "Click “Sync from GHL” to pull your GoHighLevel sub-accounts."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {locations.map((loc) => (
            <div key={loc.location_id} className="glass-card rounded-2xl px-4 py-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-border/40 flex items-center justify-center overflow-hidden shrink-0">
                {loc.logo_url ? (
                  <img src={loc.logo_url} alt="" className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">
                  {loc.business_name || (lang === "cn" ? "(未命名子账号)" : "(unnamed sub-account)")}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {loc.niche || (lang === "cn" ? "子账号" : "Sub-account")}
                  <span className="text-muted-foreground/60 font-mono"> · {loc.location_id}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0" title={lang === "cn" ? "启用/停用" : "Enable / disable"}>
                <Switch checked={loc.is_enabled} onCheckedChange={(v) => toggle(loc, v)} />
              </div>
              <button
                onClick={() => navigate(`/review-boost/location/${encodeURIComponent(loc.location_id)}/dashboard`)}
                disabled={!loc.is_enabled}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium border border-input bg-background hover:border-primary/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {lang === "cn" ? "打开" : "Open"}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
