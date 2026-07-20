import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FolderCog, Pencil, Trash2, FileText, Loader2, AlertCircle, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import {
  listKnowledge,
  saveFolder,
  deleteFolder,
  deleteArticle,
  type KBFolder,
  type KBArticleListItem,
} from "@/lib/helpdeskAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Radix occasionally leaves `pointer-events: none` on <body> after a modal
 * closes (radix-ui/primitives#2122), which silently freezes the whole page.
 * Clear it on the next tick whenever one of our dialogs closes.
 */
function releaseBodyPointerLock() {
  setTimeout(() => {
    document.body.style.pointerEvents = "";
  }, 0);
}

/**
 * Knowledge Base admin (`/admin/helpdesk/knowledge`). P3: manual CRUD for
 * folders + articles, all through the requireAdmin-gated helpdesk-admin fn (the
 * frontend never touches hd_ tables directly). Article bodies are edited on the
 * full-page editor (ArticleEdit). Notion import is P4.
 */
export default function HelpdeskKnowledge() {
  const [folders, setFolders] = useState<KBFolder[]>([]);
  const [articles, setArticles] = useState<KBArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<string>("all"); // "all" | "none" | folder id
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<KBArticleListItem | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listKnowledge()
      .then((d) => {
        setFolders(d.folders);
        setArticles(d.articles);
        setErr(null);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const folderName = (id: string | null) => folders.find((f) => f.id === id)?.name ?? null;
  const countIn = (fid: string | null) => articles.filter((a) => a.folder_id === fid).length;

  const filtered = articles.filter((a) => {
    if (activeFolder === "all") return true;
    if (activeFolder === "none") return !a.folder_id;
    return a.folder_id === activeFolder;
  });

  async function onDeleteArticle(target: KBArticleListItem) {
    // The AlertDialog closes itself via Radix (no preventDefault), so we run the
    // delete after and just refresh the list.
    try {
      await deleteArticle(target.id);
      toast.success("文章已删除");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  }

  const chip = (key: string, label: string, count: number) => (
    <button
      key={key}
      onClick={() => setActiveFolder(key)}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        activeFolder === key
          ? "bg-primary text-primary-foreground"
          : "bg-muted/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" className="gap-1.5">
          <Link to="/admin/helpdesk/knowledge/new">
            <Plus className="w-4 h-4" /> 新建文章
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setFoldersOpen(true)}>
          <FolderCog className="w-4 h-4" /> 管理文件夹
        </Button>
      </div>

      {/* Folder filter chips */}
      {!loading && !err && (
        <div className="flex flex-wrap gap-1.5">
          {chip("all", "全部", articles.length)}
          {folders.map((f) => chip(f.id, f.name, countIn(f.id)))}
          {chip("none", "未分类", countIn(null))}
        </div>
      )}

      {loading ? (
        <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : err ? (
        <div className="glass-card rounded-2xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">加载失败</p>
            <p className="text-sm text-muted-foreground mt-0.5">{err}</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {articles.length === 0 ? "还没有文章。点「新建文章」写第一篇，或等 P4 从 Notion 导入。" : "这个文件夹里还没有文章。"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <div key={a.id} className="glass-card rounded-2xl p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium truncate">{a.title}</p>
                  <Badge variant={a.source === "notion" ? "secondary" : "outline"} className="text-[10px] shrink-0">
                    {a.source === "notion" ? "Notion" : "手动"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {folderName(a.folder_id) ?? "未分类"} · {a.category} · 更新于{" "}
                  {new Date(a.updated_at).toLocaleDateString("zh-CN")}
                </p>
              </div>
              <Button asChild variant="ghost" size="icon" className="shrink-0">
                <Link to={`/admin/helpdesk/knowledge/${a.id}`} aria-label="编辑">
                  <Pencil className="w-4 h-4" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(a)}
                aria-label="删除"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Conditionally MOUNTED for the same reason as the delete dialog below —
          full unmount on close removes the portal + overlay so nothing lingers. */}
      {foldersOpen && (
        <FoldersDialog onClose={() => setFoldersOpen(false)} folders={folders} onChanged={load} />
      )}

      {/* Conditionally MOUNTED (not just `open`-toggled): when deleteTarget
          clears, the whole AlertDialog + its portal/overlay unmount at once, so
          Radix's exit-animation Presence can't leave a stuck full-screen overlay
          swallowing every click. Body pointer-events is also cleared defensively
          (radix-ui/primitives#2122). */}
      {deleteTarget && (
        <AlertDialog
          open
          onOpenChange={(o) => {
            if (!o) {
              setDeleteTarget(null);
              releaseBodyPointerLock();
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除这篇文章？</AlertDialogTitle>
              <AlertDialogDescription>
                「{deleteTarget.title}」将被永久删除，无法恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDeleteArticle(deleteTarget)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

/** Folder create / rename / delete. Deleting a folder just un-categorises its
 *  articles (FK ON DELETE SET NULL) — no article is lost. */
function FoldersDialog({
  onClose,
  folders,
  onChanged,
}: {
  onClose: () => void;
  folders: KBFolder[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName("");
    setEditingId(null);
  };

  async function submit() {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      await saveFolder(editingId ? { id: editingId, name: n } : { name: n });
      toast.success(editingId ? "文件夹已更新" : "文件夹已新建");
      reset();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await deleteFolder(id);
      toast.success("文件夹已删除（里面的文章变为未分类）");
      if (editingId === id) reset();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) {
          releaseBodyPointerLock();
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>管理文件夹</DialogTitle>
          <DialogDescription>文件夹用来给文章分组。删除文件夹不会删文章，只是把它们变成「未分类」。</DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">{editingId ? "重命名文件夹" : "新文件夹名称"}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：入门指南"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <Button onClick={submit} disabled={busy || !name.trim()} className="gap-1.5">
            {editingId ? <Pencil className="w-4 h-4" /> : <FolderPlus className="w-4 h-4" />}
            {editingId ? "保存" : "新建"}
          </Button>
          {editingId && (
            <Button variant="ghost" onClick={reset} disabled={busy}>
              取消
            </Button>
          )}
        </div>

        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {folders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">还没有文件夹。</p>
          ) : (
            folders.map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2">
                <span className="flex-1 text-sm truncate">{f.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setEditingId(f.id);
                    setName(f.name);
                  }}
                  disabled={busy}
                  aria-label="重命名"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => remove(f.id)}
                  disabled={busy}
                  aria-label="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
