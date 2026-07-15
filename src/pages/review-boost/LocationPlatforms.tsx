import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useLang } from "@/i18n/LanguageContext";
import { RB_PLATFORMS } from "@/lib/review-boost/platforms";
import { listPlatforms, savePlatform } from "@/lib/reviewBoost";

/**
 * Platforms page (`/review-boost/location/:locationId/platforms`) — the
 * sub-account enables the platforms it collects reviews on and pastes each
 * review link. All reads/writes are scoped to THIS location_id via the `rb`
 * edge function; the customer only ever touches its own data.
 */
type Row = { review_url: string; is_enabled: boolean };

export default function LocationPlatforms() {
  const { locationId } = useParams();
  const { lang } = useLang();
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!locationId) return;
      setLoading(true);
      try {
        const configs = await listPlatforms(locationId);
        if (cancelled) return;
        const next: Record<string, Row> = {};
        for (const c of configs) next[c.platform] = { review_url: c.review_url || "", is_enabled: c.is_enabled };
        setRows(next);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load platforms");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const get = (id: string): Row => rows[id] || { review_url: "", is_enabled: false };
  const set = (id: string, patch: Partial<Row>) =>
    setRows((s) => ({ ...s, [id]: { ...get(id), ...patch } }));

  const save = async (id: string) => {
    if (!locationId) return;
    const cur = get(id);
    setSavingId(id);
    try {
      await savePlatform(locationId, {
        platform: id,
        review_url: cur.review_url.trim() || null,
        is_enabled: cur.is_enabled,
      });
      toast.success(lang === "cn" ? "已保存" : "Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold">{lang === "cn" ? "平台" : "Platforms"}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === "cn"
            ? "开启你要收集评价的平台，粘贴对应的评价链接。"
            : "Enable the platforms you collect reviews on, and paste each review link."}
        </p>
      </div>

      {loading ? (
        <div className="glass-card rounded-2xl px-5 py-8 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> {lang === "cn" ? "加载中…" : "Loading…"}
        </div>
      ) : (
        <div className="space-y-3">
          {RB_PLATFORMS.map((p) => {
            const cur = get(p.id);
            return (
              <div key={p.id} className="glass-card rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ background: p.color }}
                  >
                    {p.label.en.charAt(0)}
                  </div>
                  <span className="font-display font-semibold flex-1">{p.label[lang]}</span>
                  <Switch checked={cur.is_enabled} onCheckedChange={(v) => set(p.id, { is_enabled: v })} />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={cur.review_url}
                    onChange={(e) => set(p.id, { review_url: e.target.value })}
                    placeholder={p.placeholder}
                    className="glass-input flex-1 px-4 py-2.5 text-sm"
                  />
                  <button
                    onClick={() => save(p.id)}
                    disabled={savingId === p.id}
                    className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shrink-0 disabled:opacity-70"
                    style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
                  >
                    {savingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {lang === "cn" ? "保存" : "Save"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
