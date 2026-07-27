import { useEffect, useState } from "react";
import { Plug, Loader2, CheckCircle2, XCircle, Palette, ListTree, Copy, Database, RefreshCw, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  testNotion,
  listNotionDatabases,
  getNotionConfig,
  addNotionDatabase,
  removeNotionDatabase,
  planNotionSync,
  runNotionSyncBatch,
  getStorageUsage,
  type NotionTestResult,
  type NotionDatabase,
} from "@/lib/helpdeskAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SyncProgress = { total: number; processed: number; done: number; failed: number; skipped: number };

/**
 * Helpdesk settings (`/admin/helpdesk/settings`).
 * P4a: Notion connection TEST only — enter a database ID, confirm we can reach
 * it and read its title + page count. Imports nothing. Actual sync (batched,
 * for the ~1100-article corpus) is P4b; widget branding is P9.
 */
export default function HelpdeskSettings() {
  const [dbId, setDbId] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<NotionTestResult | null>(null);

  const [listing, setListing] = useState(false);
  const [dbList, setDbList] = useState<NotionDatabase[] | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);

  async function onTest() {
    const id = dbId.trim();
    if (!id) return;
    setTesting(true);
    setResult(null);
    try {
      setResult(await testNotion(id));
    } catch (e) {
      // Real faults (e.g. not_authorized / network) — surface as a failure card.
      setResult({ ok: false, message: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setTesting(false);
    }
  }

  async function onList() {
    setListing(true);
    setListErr(null);
    setDbList(null);
    try {
      const r = await listNotionDatabases();
      if (r.ok && r.databases) setDbList(r.databases);
      else setListErr(r.message || "列出失败");
    } catch (e) {
      setListErr(e instanceof Error ? e.message : "请求失败");
    } finally {
      setListing(false);
    }
  }

  function copyId(id: string) {
    navigator.clipboard?.writeText(id).then(
      () => toast.success("已复制数据库 ID"),
      () => toast.error("复制失败"),
    );
  }

  // ── Connected databases (manual list) + batched sync ──────────────────────
  const [dbIds, setDbIds] = useState<string[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [newDbId, setNewDbId] = useState("");
  const [adding, setAdding] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [forceReimport, setForceReimport] = useState(false);
  const [lastResult, setLastResult] = useState<Record<string, { done: number; skipped: number; failed: number }>>({});
  const [usage, setUsage] = useState<{ bytes: number; files: number } | null>(null);

  useEffect(() => {
    getNotionConfig()
      .then(setDbIds)
      .catch(() => setDbIds([]))
      .finally(() => setLoadingList(false));
    getStorageUsage()
      .then(setUsage)
      .catch(() => {});
  }, []);

  const fmtMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(bytes >= 1024 * 1024 * 100 ? 0 : 1);

  async function onAddDb() {
    const id = newDbId.trim();
    if (!id) return;
    setAdding(true);
    try {
      setDbIds(await addNotionDatabase(id));
      setNewDbId("");
      toast.success("已加入同步列表");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "添加失败");
    } finally {
      setAdding(false);
    }
  }

  async function onRemoveDb(id: string) {
    try {
      setDbIds(await removeNotionDatabase(id));
      toast.success("已从列表移除");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "移除失败");
    }
  }

  async function onSyncDb(id: string) {
    if (syncingId) return;
    setSyncingId(id);
    setProgress({ total: 0, processed: 0, done: 0, failed: 0, skipped: 0 });
    try {
      const plan = await planNotionSync(id, forceReimport);
      if (!plan.ok) {
        toast.error(plan.message || "规划失败");
        return;
      }
      const total = plan.total ?? 0;
      const skipped = plan.skipped ?? 0;
      let done = 0;
      let failed = 0;
      setProgress({ total, processed: skipped, done, failed, skipped });
      if ((plan.pending ?? 0) === 0) {
        toast.success(`都是最新的，无需更新（${skipped} 篇）`);
        setLastResult((prev) => ({ ...prev, [id]: { done, skipped, failed } }));
        return;
      }
      let remaining = plan.pending ?? 0;
      while (remaining > 0) {
        const b = await runNotionSyncBatch(id);
        if (!b.ok) {
          toast.error(b.message || "同步失败");
          break;
        }
        done += b.batchDone ?? 0;
        failed += b.batchFailed ?? 0;
        remaining = b.remaining ?? 0;
        setProgress({ total: b.total ?? total, processed: skipped + done + failed, done, failed, skipped });
      }
      toast.success(`同步完成：导入/更新 ${done}，跳过 ${skipped}，失败 ${failed}`);
      setLastResult((prev) => ({ ...prev, [id]: { done, skipped, failed } }));
      getStorageUsage().then(setUsage).catch(() => {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "同步出错");
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Notion connection test */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[#fed50a] shrink-0"
            style={{ background: "#141414" }}
          >
            <Plug className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-semibold">Notion 同步</h2>
            <p className="text-sm text-muted-foreground">先测试能否连上你的 Notion 数据库（只读取，不导入任何东西）。</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="hd-notion-db" className="text-xs text-muted-foreground">
              数据库 ID
            </Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="hd-notion-db"
                value={dbId}
                onChange={(e) => setDbId(e.target.value)}
                placeholder="例如 27528b270a6d80769708f7f9646de56a"
                className="font-mono text-sm"
                onKeyDown={(e) => e.key === "Enter" && !testing && onTest()}
              />
              <Button onClick={onTest} disabled={testing || !dbId.trim()} className="gap-1.5 shrink-0">
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                {testing ? "测试中…" : "测试连接"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              数据库 ID 在 Notion 数据库网址里：<code className="text-[11px]">notion.so/<b>这段32位字符</b>?v=…</code>。
              别忘了在 Notion 里把该数据库 <b>••• → Connections</b> 分享给你的集成，否则会「找不到」。
            </p>
          </div>

          {result && (
            <div
              className={`rounded-xl border p-4 flex items-start gap-3 ${
                result.ok ? "border-[#141414]/20 bg-[#fed50a]/20" : "border-[#141414]/30 bg-[#141414]/[0.05]"
              }`}
            >
              {result.ok ? (
                <CheckCircle2 className="w-5 h-5 text-[#141414] shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-[#141414] shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 text-sm">
                {result.ok ? (
                  <p>
                    已连上《<b>{result.title}</b>》，共 <b className="tabular-nums">{result.pageCount}</b> 篇文章。
                  </p>
                ) : (
                  <p className="text-[#141414]">{result.message}</p>
                )}
              </div>
            </div>
          )}

          {/* Discover: list every database the integration can see */}
          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">不确定用哪个库？让集成把它能访问的数据库都列出来：</p>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={onList} disabled={listing}>
                {listing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListTree className="w-4 h-4" />}
                {listing ? "列出中…" : "列出数据库"}
              </Button>
            </div>

            {listErr && <p className="text-sm text-[#141414] mt-2">{listErr}</p>}

            {dbList && (
              <div className="mt-3 space-y-1.5">
                {dbList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    没有找到任何数据库——说明还没有数据库被分享给这个集成（在 Notion 里 ••• → Connections 加上）。
                  </p>
                ) : (
                  dbList.map((d) => (
                    <div key={d.id} className="rounded-xl border border-border/50 px-3 py-2 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.title}</p>
                        <p className="text-[11px] text-muted-foreground font-mono truncate">{d.id}</p>
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                        {d.pageCount}
                        {d.capped ? "+" : ""} 篇
                      </span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyId(d.id)} aria-label="复制 ID">
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-xs"
                        onClick={() => {
                          setDbId(d.id);
                          setResult(null);
                        }}
                      >
                        填入
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Connected databases (manual list) + per-database sync */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[#fed50a] shrink-0"
            style={{ background: "#141414" }}
          >
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-semibold">已连接的数据库</h2>
            <p className="text-sm text-muted-foreground">手动加入要同步的库，每个可单独同步。只同步你加进来的这些。</p>
          </div>
        </div>

        <label className="flex items-center gap-2 mb-3 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={forceReimport}
            onChange={(e) => setForceReimport(e.target.checked)}
            className="accent-primary"
          />
          强制重新导入（忽略「没变化」，把全部文章重拉一遍——首次补图片视频时勾上）
        </label>

        <div className="flex gap-2">
          <Input
            value={newDbId}
            onChange={(e) => setNewDbId(e.target.value)}
            placeholder="粘贴 Notion 数据库 ID"
            className="font-mono text-sm"
            onKeyDown={(e) => e.key === "Enter" && !adding && onAddDb()}
          />
          <Button onClick={onAddDb} disabled={adding || !newDbId.trim()} className="gap-1.5 shrink-0">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            添加
          </Button>
        </div>

        <div className="mt-3 space-y-1.5">
          {loadingList ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : dbIds.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">还没有加入任何数据库。用上面的搜索找到你的库、复制 ID 加进来。</p>
          ) : (
            dbIds.map((id) => {
              const isSyncing = syncingId === id;
              const pct = progress && progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
              return (
                <div key={id} className="rounded-xl border border-border/50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <p className="flex-1 min-w-0 text-xs font-mono truncate text-muted-foreground">{id}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 shrink-0"
                      onClick={() => onSyncDb(id)}
                      disabled={!!syncingId}
                    >
                      {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      {isSyncing ? "同步中…" : "同步"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-[#141414] hover:text-[#141414]"
                      onClick={() => onRemoveDb(id)}
                      disabled={!!syncingId}
                      aria-label="移除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {isSyncing && progress && (
                    <div className="mt-2">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: "#fed50a" }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                        已处理 {progress.processed} / {progress.total} · 导入 {progress.done} · 跳过 {progress.skipped}
                        {progress.failed > 0 ? ` · 失败 ${progress.failed}` : ""}
                      </p>
                    </div>
                  )}

                  {!isSyncing && lastResult[id] && (
                    <p className="text-[11px] mt-1.5 tabular-nums">
                      <span className="text-muted-foreground">
                        上次：导入 {lastResult[id].done} · 跳过 {lastResult[id].skipped}
                      </span>
                      {lastResult[id].failed > 0 && (
                        <span className="text-[#141414]"> · 失败 {lastResult[id].failed}（再点「同步」可重试失败的）</span>
                      )}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {usage && (
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
            已用存储：<b className="tabular-nums">{fmtMB(usage.bytes)} MB</b>（{usage.files} 个媒体文件）—— 用来盯 Supabase Storage 额度。
          </p>
        )}
      </div>

      {/* Widget branding — later phase */}
      <div className="glass-card rounded-2xl p-6 opacity-70">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground bg-muted shrink-0">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-semibold">挂件品牌</h2>
            <p className="text-sm text-muted-foreground">标题 / 颜色 / logo — P9 再做。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
