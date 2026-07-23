import { useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listUpdates, saveUpdate, deleteUpdate, type HdUpdate } from "@/lib/helpdeskAdmin";
import Markdown from "@/components/helpdesk/Markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

/** Clear a stuck body pointer-lock Radix can leave after a modal closes
 *  (radix-ui/primitives#2122). Same guard as the KB admin. */
function releaseBodyPointerLock() {
  setTimeout(() => {
    document.body.style.pointerEvents = "";
  }, 0);
}

/**
 * Product Updates admin (`/admin/helpdesk/updates`). P8: manual publish — create
 * / edit / delete update posts (title + markdown content + optional image/link),
 * all through the requireAdmin-gated helpdesk-admin fn. Publishes immediately
 * (no draft): a saved post shows in the customer help center's 产品更新 tab, with
 * the create date. FAQ was intentionally not built (owner's call).
 */
export default function HelpdeskUpdates() {
  const [updates, setUpdates] = useState<HdUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<HdUpdate | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HdUpdate | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listUpdates()
      .then((u) => {
        setUpdates(u);
        setErr(null);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onDelete(target: HdUpdate) {
    try {
      await deleteUpdate(target.id);
      toast.success("更新已删除");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          发布产品动态；保存后立即显示在客户帮助中心的「产品更新」里。
        </p>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setEditing("new")}>
          <Plus className="w-4 h-4" /> 新建更新
        </Button>
      </div>

      {loading ? (
        <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : err ? (
        <div className="glass-card rounded-2xl p-6 text-sm">加载失败：{err}</div>
      ) : updates.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <Megaphone className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">还没有产品更新。点「新建更新」发布第一条。</p>
        </div>
      ) : (
        <div className="space-y-2">
          {updates.map((u) => (
            <div key={u.id} className="glass-card rounded-2xl p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{u.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(u.created_at).toLocaleDateString("zh-CN")}
                  {u.image_url ? " · 有配图" : ""}
                  {u.link ? " · 有链接" : ""}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setEditing(u)} aria-label="编辑">
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(u)}
                aria-label="删除"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <UpdateDialog
          update={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}

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
              <AlertDialogTitle>删除这条更新？</AlertDialogTitle>
              <AlertDialogDescription>「{deleteTarget.title}」将被永久删除，无法恢复。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(deleteTarget)}
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

function UpdateDialog({
  update,
  onClose,
  onSaved,
}: {
  update: HdUpdate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(update?.title ?? "");
  const [description, setDescription] = useState(update?.description ?? "");
  const [imageUrl, setImageUrl] = useState(update?.image_url ?? "");
  const [link, setLink] = useState(update?.link ?? "");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const t = title.trim();
    if (!t) {
      toast.error("请填写标题");
      return;
    }
    setBusy(true);
    try {
      await saveUpdate({
        id: update?.id,
        title: t,
        description,
        image_url: imageUrl.trim() || null,
        link: link.trim() || null,
      });
      toast.success(update ? "更新已保存" : "更新已发布");
      releaseBodyPointerLock();
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{update ? "编辑更新" : "新建更新"}</DialogTitle>
          <DialogDescription>保存后立即显示在客户帮助中心。日期用发布时间。</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">标题 *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：新增 WhatsApp 群发功能" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">内容（支持 Markdown）</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="这次更新做了什么…支持 **加粗**、列表、链接等。"
              rows={6}
              className="font-mono text-sm"
            />
            {description.trim() && (
              <div className="mt-2 rounded-xl border border-border/50 p-3">
                <p className="text-[11px] text-muted-foreground mb-1.5">预览</p>
                <Markdown>{description}</Markdown>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground">配图链接（可选）</label>
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…/image.png" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">相关链接（可选）</label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://… 点「了解更多」会打开" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              取消
            </Button>
            <Button onClick={submit} disabled={busy || !title.trim()} className="gap-1.5">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {update ? "保存" : "发布"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
