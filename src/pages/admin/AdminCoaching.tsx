import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import {
  listCoachingSessions,
  saveCoachingSession,
  deleteCoachingSession,
  type CoachingSession,
} from "@/lib/adminApi";
import { formatCoachingDate } from "@/lib/coaching";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const CN_WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/** Parse `YYYY-MM-DD` as a LOCAL date. `new Date(iso)` reads a bare date as UTC
 *  midnight, which lands on the previous day west of Greenwich — and this value
 *  decides whether the "not a Monday" warning fires. */
const parseIso = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const isMonday = (iso: string) => parseIso(iso).getDay() === 1;
const weekdayCn = (iso: string) => CN_WEEKDAYS[parseIso(iso).getDay()];

/** Clear a stuck body pointer-lock Radix can leave after a modal closes
 *  (radix-ui/primitives#2122). Same guard as the KB admin. */
function releaseBodyPointerLock() {
  setTimeout(() => {
    document.body.style.pointerEvents = "";
  }, 0);
}

/**
 * Coaching Night admin (`/admin/coaching`). Replaces the weekly code edit: the
 * past-replay list on the Playbook homepage used to be a hardcoded array in
 * src/lib/coaching.ts, so publishing a replay meant a commit and a deploy.
 *
 * Sits at the top level of the portal, not inside a tool shell — Coaching Night
 * is homepage content every sub-account sees, not part of any one tool. Writes
 * go through the requireAdmin-gated `admin` fn; the homepage reads them back
 * through the public read-only `coaching` fn.
 *
 * Step 1 = replays only. A session saved without a replay link is stored (the
 * column is nullable by design) but does NOT appear on the homepage yet — the
 * 「即将到来」 block is still computed by HeroSection's fortnight algorithm until
 * step 2 moves scheduling into this table too.
 */
export default function AdminCoaching() {
  const [sessions, setSessions] = useState<CoachingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<CoachingSession | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CoachingSession | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listCoachingSessions()
      .then((s) => {
        setSessions(s);
        setErr(null);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onDelete(target: CoachingSession) {
    try {
      await deleteCoachingSession(target.id);
      toast.success("录像已删除");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-display font-bold">Coaching Night 录像</h1>
          <p className="text-sm text-muted-foreground mt-1">
            保存后立即显示在首页「过往录像」，不需要改代码、不需要发版。填了录像链接才会显示在首页。
          </p>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setEditing("new")}>
          <Plus className="w-4 h-4" /> 新增录像
        </Button>
      </div>

      {loading ? (
        <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : err ? (
        <div className="glass-card rounded-2xl p-6 text-sm">加载失败：{err}</div>
      ) : sessions.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <Video className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">还没有录像。点「新增录像」加第一条。</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="glass-card rounded-2xl p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {formatCoachingDate(s.session_date)}
                  {s.topic ? <span className="text-muted-foreground font-normal"> · {s.topic}</span> : null}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {s.replay_url ? "有录像链接 · 已显示在首页" : "无录像链接 · 首页不显示"}
                  {s.cover_url ? " · 有封面" : " · 无封面（用默认底图）"}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setEditing(s)} aria-label="编辑">
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(s)}
                aria-label="删除"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <SessionDialog
          session={editing === "new" ? null : editing}
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
              <AlertDialogTitle>删除这条录像？</AlertDialogTitle>
              <AlertDialogDescription>
                「{formatCoachingDate(deleteTarget.session_date)}
                {deleteTarget.topic ? ` · ${deleteTarget.topic}` : ""}」将被永久删除，无法恢复。
                删除后首页「过往录像」会少这一条。
              </AlertDialogDescription>
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

function SessionDialog({
  session,
  onClose,
  onSaved,
}: {
  session: CoachingSession | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(session?.session_date ?? "");
  const [topic, setTopic] = useState(session?.topic ?? "");
  const [replayUrl, setReplayUrl] = useState(session?.replay_url ?? "");
  const [coverUrl, setCoverUrl] = useState(session?.cover_url ?? "");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!date) {
      toast.error("请选择日期");
      return;
    }
    setBusy(true);
    try {
      await saveCoachingSession({
        id: session?.id,
        session_date: date,
        topic: topic.trim(),
        replay_url: replayUrl.trim() || null,
        cover_url: coverUrl.trim() || null,
      });
      toast.success(session ? "录像已保存" : "录像已发布");
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{session ? "编辑录像" : "新增录像"}</DialogTitle>
          <DialogDescription>
            保存后立即显示在首页「过往录像」，按日期从新到旧排列。
            {date ? `首页会显示成：${formatCoachingDate(date)}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">日期 *</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1">
              填<strong className="text-foreground">上课日期（周一）</strong>，不是上传日期。填错的话首页日历上会对不上，那条录像点不到。
            </p>
            {/* Soft warning, never a block: make-up classes and one-off sessions
                are real. The failure this catches is silent — a Tuesday upload
                date saves fine, then highlights a Tuesday on the homepage
                calendar that no replay will ever match, and nothing errors. */}
            {date && !isMonday(date) && (
              <p className="text-[11px] font-semibold text-foreground mt-1 rounded-lg border-2 border-[#141414] bg-[#fed50a] px-2 py-1.5">
                这不是周一（{weekdayCn(date)}），确认是上课日期吗？补课或特殊场次可以照常保存。
              </p>
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground">主题</label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="例如：转化" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">录像链接</label>
            <Input
              value={replayUrl}
              onChange={(e) => setReplayUrl(e.target.value)}
              placeholder="https://…/xxxx.mp4"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              留空 = 这场还没有录像，首页「过往录像」不会显示它。
            </p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">封面链接（可选）</label>
            <Input
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://…/cover.png　留空用默认底图"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              取消
            </Button>
            <Button onClick={submit} disabled={busy || !date} className="gap-1.5">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {session ? "保存" : "发布"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
