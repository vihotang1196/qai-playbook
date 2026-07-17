import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageContext";
import { RB_PLATFORMS } from "@/lib/review-boost/platforms";
import { listPlatforms, savePlatformLink, deletePlatformLink } from "@/lib/reviewBoost";

/**
 * Platforms page (`/review-boost/location/:locationId/platforms`) — the
 * sub-account manages its review links. A platform can hold MANY links (e.g.
 * several Google pages for several branches), each with an optional name. A link
 * simply existing means it's usable — there is no on/off toggle. All reads/writes
 * are scoped to THIS location_id via the `rb` edge function.
 */
type LinkRow = { key: string; id?: string; label: string; review_url: string };

export default function LocationPlatforms() {
  const { locationId } = useParams();
  const { lang } = useLang();
  // Links grouped by platform id (google_maps / facebook / shopee / custom).
  const [rows, setRows] = useState<Record<string, LinkRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const keyRef = useRef(0);
  const newKey = () => `new-${keyRef.current++}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!locationId) return;
      setLoading(true);
      try {
        const links = await listPlatforms(locationId);
        if (cancelled) return;
        const grouped: Record<string, LinkRow[]> = {};
        for (const l of links) {
          (grouped[l.platform] ||= []).push({
            key: l.id,
            id: l.id,
            label: l.label || "",
            review_url: l.review_url || "",
          });
        }
        setRows(grouped);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load links");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const label = (cn: string, en: string) => (lang === "cn" ? cn : en);
  const getRows = (pid: string): LinkRow[] => rows[pid] || [];

  const patchRow = (pid: string, key: string, patch: Partial<LinkRow>) =>
    setRows((s) => ({
      ...s,
      [pid]: (s[pid] || []).map((r) => (r.key === key ? { ...r, ...patch } : r)),
    }));

  const addRow = (pid: string) =>
    setRows((s) => ({ ...s, [pid]: [...(s[pid] || []), { key: newKey(), label: "", review_url: "" }] }));

  const dropRowLocal = (pid: string, key: string) =>
    setRows((s) => ({ ...s, [pid]: (s[pid] || []).filter((r) => r.key !== key) }));

  const saveRow = async (pid: string, row: LinkRow) => {
    if (!locationId) return;
    if (!row.review_url.trim()) {
      toast.error(label("请先填链接", "Enter a link first"));
      return;
    }
    setBusyKey(row.key);
    try {
      const saved = await savePlatformLink(locationId, {
        id: row.id,
        platform: pid,
        review_url: row.review_url.trim(),
        label: row.label.trim() || null,
      });
      // Promote a new draft row to a saved one (gets its db id + key).
      patchRow(pid, row.key, { id: saved.id, key: saved.id, label: saved.label || "", review_url: saved.review_url });
      toast.success(label("已保存", "Saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusyKey(null);
    }
  };

  const deleteRow = async (pid: string, row: LinkRow) => {
    // Unsaved draft → just remove locally.
    if (!row.id) {
      dropRowLocal(pid, row.key);
      return;
    }
    if (!locationId) return;
    if (!window.confirm(label("删除这条链接？指向它的活动会变成未指定链接。", "Delete this link? Campaigns pointing at it will lose the link."))) {
      return;
    }
    setBusyKey(row.key);
    try {
      await deletePlatformLink(locationId, row.id);
      dropRowLocal(pid, row.key);
      toast.success(label("已删除", "Deleted"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold">{label("平台", "Platforms")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {label(
            "为每个平台添加评价链接——同一平台可加多条（多家店），每条可起个名字方便分辨。",
            "Add review links per platform — several per platform (multiple branches), each with an optional name.",
          )}
        </p>
      </div>

      {loading ? (
        <div className="glass-card rounded-2xl px-5 py-8 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> {label("加载中…", "Loading…")}
        </div>
      ) : (
        <div className="space-y-3">
          {RB_PLATFORMS.map((p) => {
            const list = getRows(p.id);
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
                  <span className="text-xs text-muted-foreground">
                    {list.length} {label("条", list.length === 1 ? "link" : "links")}
                  </span>
                </div>

                <div className="space-y-2">
                  {list.map((row) => (
                    <div key={row.key} className="rounded-xl border border-border/50 p-3 space-y-2">
                      <input
                        value={row.label}
                        onChange={(e) => patchRow(p.id, row.key, { label: e.target.value })}
                        placeholder={label("名称（选填），如 美容院-总店", "Name (optional), e.g. Main branch")}
                        className="glass-input w-full px-3 py-2 text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          value={row.review_url}
                          onChange={(e) => patchRow(p.id, row.key, { review_url: e.target.value })}
                          placeholder={p.placeholder}
                          className="glass-input flex-1 px-3 py-2 text-sm"
                        />
                        <button
                          onClick={() => saveRow(p.id, row)}
                          disabled={busyKey === row.key}
                          className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-white shrink-0 disabled:opacity-70"
                          style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
                        >
                          {busyKey === row.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          {label("保存", "Save")}
                        </button>
                        <button
                          onClick={() => deleteRow(p.id, row)}
                          disabled={busyKey === row.key}
                          className="inline-flex items-center justify-center rounded-xl w-9 h-9 border border-border/60 text-muted-foreground hover:text-red-500 hover:border-red-500/40 shrink-0 disabled:opacity-60"
                          aria-label={label("删除", "Delete")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => addRow(p.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-primary border border-dashed border-primary/40 hover:bg-primary/5 w-full justify-center"
                  >
                    <Plus className="w-4 h-4" /> {label("添加一条链接", "Add a link")}
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
