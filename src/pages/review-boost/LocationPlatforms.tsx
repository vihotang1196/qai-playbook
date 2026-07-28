import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Check, Plus, Trash2, Pencil, X, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageContext";
import { RB_PLATFORMS } from "@/lib/review-boost/platforms";
import { listPlatforms, savePlatformLink, deletePlatformLink } from "@/lib/reviewBoost";

/**
 * Platforms page (`/review-boost/location/:locationId/platforms`) — the customer
 * manages its review links. A platform can hold MANY links (several branches),
 * each with an optional name. Compact list: each link shows just its NAME; the
 * URL is tucked away and only appears when you edit/add. All reads/writes scoped
 * to this location via the `rb` edge function.
 */
type LinkRow = { key: string; id?: string; label: string; review_url: string };

export default function LocationPlatforms() {
  const { locationId } = useParams();
  const { lang } = useLang();
  const [rows, setRows] = useState<Record<string, LinkRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // Draft field values while editing (kept separate so cancel restores cleanly).
  const [draft, setDraft] = useState<{ label: string; review_url: string }>({ label: "", review_url: "" });
  const keyRef = useRef(0);
  const newKey = () => `new-${keyRef.current++}`;

  const label = (cn: string, en: string) => (lang === "cn" ? cn : en);

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
          (grouped[l.platform] ||= []).push({ key: l.id, id: l.id, label: l.label || "", review_url: l.review_url || "" });
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

  const getRows = (pid: string): LinkRow[] => rows[pid] || [];

  const startEdit = (row: LinkRow) => {
    setEditingKey(row.key);
    setDraft({ label: row.label, review_url: row.review_url });
  };

  const addRow = (pid: string) => {
    const key = newKey();
    setRows((s) => ({ ...s, [pid]: [...(s[pid] || []), { key, label: "", review_url: "" }] }));
    setEditingKey(key);
    setDraft({ label: "", review_url: "" });
  };

  const cancelEdit = (pid: string, row: LinkRow) => {
    // Drop an unsaved draft entirely; keep an existing row.
    if (!row.id) setRows((s) => ({ ...s, [pid]: (s[pid] || []).filter((r) => r.key !== row.key) }));
    setEditingKey(null);
  };

  const save = async (pid: string, row: LinkRow) => {
    if (!locationId) return;
    if (!draft.review_url.trim()) {
      toast.error(label("请先填链接", "Enter a link first"));
      return;
    }
    setBusyKey(row.key);
    try {
      const saved = await savePlatformLink(locationId, {
        id: row.id,
        platform: pid,
        review_url: draft.review_url.trim(),
        label: draft.label.trim() || null,
      });
      setRows((s) => ({
        ...s,
        [pid]: (s[pid] || []).map((r) =>
          r.key === row.key ? { key: saved.id, id: saved.id, label: saved.label || "", review_url: saved.review_url } : r,
        ),
      }));
      setEditingKey(null);
      toast.success(label("已保存", "Saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusyKey(null);
    }
  };

  // Unsaved draft rows vanish immediately; a SAVED link needs confirmation, and
  // that confirmation is in-app (a suppressed window.confirm would have made the
  // delete button look broken).
  const [confirmDel, setConfirmDel] = useState<{ pid: string; row: LinkRow } | null>(null);

  const requestRemove = (pid: string, row: LinkRow) => {
    if (!row.id) {
      setRows((s) => ({ ...s, [pid]: (s[pid] || []).filter((r) => r.key !== row.key) }));
      return;
    }
    setConfirmDel({ pid, row });
  };

  const remove = async (pid: string, row: LinkRow) => {
    if (!locationId || !row.id) return;
    setBusyKey(row.key);
    try {
      await deletePlatformLink(locationId, row.id);
      setRows((s) => ({ ...s, [pid]: (s[pid] || []).filter((r) => r.key !== row.key) }));
      setConfirmDel(null);
      toast.success(label("链接已删除", "Link deleted"));
    } catch (e) {
      setConfirmDel(null);
      toast.error(e instanceof Error ? e.message : label("删除失败", "Delete failed"), { duration: 8000 });
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
            "为每个平台添加评价链接——同一平台可加多条（多家店），每条起个名字方便分辨。",
            "Add review links per platform — several per platform (multiple branches), each with a name.",
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
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-[#fed50a] text-sm font-bold shrink-0"
                    style={{ background: "#141414" }}
                  >
                    {p.label.en.charAt(0)}
                  </div>
                  <span className="font-display font-semibold flex-1">{p.label[lang]}</span>
                  <span className="text-xs text-muted-foreground">
                    {list.length} {label("条", list.length === 1 ? "link" : "links")}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {list.map((row) =>
                    editingKey === row.key ? (
                      // ── Expanded editor ──────────────────────────────
                      <div key={row.key} className="rounded-xl border-2 border-[#141414]/30 bg-[#fed50a]/10 p-3 space-y-2">
                        <input
                          value={draft.label}
                          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                          placeholder={label("名称（选填），如 美容院-总店", "Name (optional), e.g. Main branch")}
                          className="glass-input w-full px-3 py-2 text-sm"
                        />
                        <input
                          value={draft.review_url}
                          onChange={(e) => setDraft((d) => ({ ...d, review_url: e.target.value }))}
                          placeholder={p.placeholder}
                          className="glass-input w-full px-3 py-2 text-sm"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => save(p.id, row)}
                            disabled={busyKey === row.key}
                            className="btn-gradient inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold disabled:opacity-70"
                          >
                            {busyKey === row.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            {label("保存", "Save")}
                          </button>
                          <button
                            onClick={() => cancelEdit(p.id, row)}
                            className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-4 h-4" /> {label("取消", "Cancel")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      // ── Compact row (name only) ──────────────────────
                      <div key={row.key} className="rounded-xl border border-border/50 px-3 py-2.5 flex items-center gap-2">
                        <LinkIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className={`text-sm flex-1 min-w-0 truncate ${row.label ? "" : "text-muted-foreground/60"}`}>
                          {row.label || label("(未命名)", "(unnamed)")}
                        </span>
                        <button
                          onClick={() => startEdit(row)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-[#141414] shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5" /> {label("编辑", "Edit")}
                        </button>
                        <button
                          onClick={() => requestRemove(p.id, row)}
                          disabled={busyKey === row.key}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-[#141414] shrink-0 disabled:opacity-60"
                          aria-label={label("删除", "Delete")}
                        >
                          {busyKey === row.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ),
                  )}

                  <button
                    onClick={() => addRow(p.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-[#141414] border-2 border-dashed border-[#141414]/40 hover:bg-[#fed50a]/10 w-full justify-center mt-1"
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
