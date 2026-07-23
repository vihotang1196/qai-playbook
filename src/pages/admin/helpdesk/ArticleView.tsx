import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getArticle, type KBArticle } from "@/lib/helpdeskAdmin";
import Markdown from "@/components/helpdesk/Markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Read-only article view (`/admin/helpdesk/knowledge/:articleId`). The knowledge
 * base is a mirror of Notion — content is authored in Notion and pulled in by the
 * sync, so it is NOT editable here (editing would be overwritten on the next
 * sync). This page just renders the synced article.
 */
export default function HelpdeskArticleView() {
  const { articleId } = useParams();
  const [article, setArticle] = useState<KBArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getArticle(articleId!)
      .then((a) => {
        if (cancelled) return;
        setArticle(a);
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
  }, [articleId]);

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (err || !article) {
    return <div className="glass-card rounded-2xl p-6 text-sm">加载失败：{err ?? "无数据"}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2">
          <Link to="/admin/helpdesk/knowledge">
            <ArrowLeft className="w-4 h-4" /> 返回
          </Link>
        </Button>
        {article.source === "notion" && <Badge variant="secondary">来自 Notion</Badge>}
      </div>

      <div className="glass-card rounded-2xl p-6 sm:p-8">
        <h1 className="text-2xl font-display font-bold mb-1">{article.title}</h1>
        <p className="text-xs text-muted-foreground mb-5">
          {article.category}
          {article.source === "notion" ? " · 内容在 Notion 里编辑，同步自动更新" : ""}
        </p>
        {article.content?.trim() ? (
          <Markdown>{article.content}</Markdown>
        ) : (
          <p className="text-sm text-muted-foreground">（这篇文章没有正文内容。）</p>
        )}
      </div>
    </div>
  );
}
