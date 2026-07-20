import { useState } from "react";
import { Plug, Loader2, CheckCircle2, XCircle, Palette } from "lucide-react";
import { testNotion, type NotionTestResult } from "@/lib/helpdeskAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  return (
    <div className="space-y-5">
      {/* Notion connection test */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
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
                result.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"
              }`}
            >
              {result.ok ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 text-sm">
                {result.ok ? (
                  <p>
                    已连上《<b>{result.title}</b>》，共 <b className="tabular-nums">{result.pageCount}</b> 篇文章。
                  </p>
                ) : (
                  <p className="text-destructive">{result.message}</p>
                )}
              </div>
            </div>
          )}
        </div>
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
