import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getArticle, saveArticle, listKnowledge, type KBFolder } from "@/lib/helpdeskAdmin";
import Markdown from "@/components/helpdesk/Markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE = "__none__"; // shadcn Select can't use an empty-string value

/**
 * Full-page article editor (`/admin/helpdesk/knowledge/new` + `.../:articleId`).
 * Markdown textarea on the left, live preview on the right (shared Markdown
 * renderer, reused by the P6 widget). Saves through the requireAdmin-gated
 * helpdesk-admin fn. Editing never rewrites source/source_id, so a Notion-linked
 * article keeps its linkage.
 */
export default function HelpdeskArticleEdit() {
  const { articleId } = useParams();
  const isEdit = !!articleId;
  const navigate = useNavigate();

  const [folders, setFolders] = useState<KBFolder[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [folderId, setFolderId] = useState<string>(NONE);
  const [source, setSource] = useState<string>("manual");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listKnowledge(), isEdit ? getArticle(articleId!) : Promise.resolve(null)])
      .then(([kb, article]) => {
        if (cancelled) return;
        setFolders(kb.folders);
        if (article) {
          setTitle(article.title);
          setContent(article.content ?? "");
          setCategory(article.category || "general");
          setFolderId(article.folder_id ?? NONE);
          setSource(article.source || "manual");
        }
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [articleId, isEdit]);

  async function onSave() {
    if (!title.trim()) {
      toast.error("请先填写标题");
      return;
    }
    setSaving(true);
    try {
      await saveArticle({
        id: articleId,
        title: title.trim(),
        content,
        category: category.trim() || "general",
        folder_id: folderId === NONE ? null : folderId,
      });
      toast.success(isEdit ? "已保存" : "文章已创建");
      navigate("/admin/helpdesk/knowledge");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (err) {
    return <div className="glass-card rounded-2xl p-6 text-sm">加载失败：{err}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2">
          <Link to="/admin/helpdesk/knowledge">
            <ArrowLeft className="w-4 h-4" /> 返回
          </Link>
        </Button>
        <h2 className="text-lg font-display font-semibold">{isEdit ? "编辑文章" : "新建文章"}</h2>
        {source === "notion" && <Badge variant="secondary">来自 Notion</Badge>}
        <Button onClick={onSave} disabled={saving} size="sm" className="ml-auto gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "保存中…" : "保存"}
        </Button>
      </div>

      {/* Meta */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div>
          <Label htmlFor="hd-title" className="text-xs text-muted-foreground">
            标题
          </Label>
          <Input
            id="hd-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="文章标题"
            className="mt-1"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">文件夹</Label>
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="未分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>未分类</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="hd-cat" className="text-xs text-muted-foreground">
              分类标签
            </Label>
            <Input
              id="hd-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="general"
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* Editor + live preview */}
      <div className="grid lg:grid-cols-2 gap-3">
        <div className="glass-card rounded-2xl p-3">
          <p className="text-xs text-muted-foreground mb-1.5 px-1">正文（Markdown）</p>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={"用 Markdown 书写：\n\n# 标题\n**加粗**、*斜体*\n- 列表项\n[链接](https://...)"}
            className="min-h-[440px] font-mono text-sm leading-relaxed resize-y"
          />
        </div>
        <div className="glass-card rounded-2xl p-4 overflow-auto min-h-[440px]">
          <p className="text-xs text-muted-foreground mb-2">预览</p>
          {content.trim() ? (
            <Markdown>{content}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground/60">在左边输入内容，这里实时预览。</p>
          )}
        </div>
      </div>
    </div>
  );
}
