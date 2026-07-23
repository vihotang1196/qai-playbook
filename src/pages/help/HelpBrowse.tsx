import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, FileText, FolderOpen, Loader2, Search } from "lucide-react";
import {
  getArticle,
  listArticles,
  listFolders,
  type HelpArticle,
  type HelpArticleListItem,
  type HelpFolder,
} from "@/lib/helpdesk";
import Markdown from "@/components/helpdesk/Markdown";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * 浏览教程 tab — browse the shared knowledge base by category folder, open one
 * to read (read-only render via the shared Markdown component; images + <video>
 * show). Reads through the PUBLIC helpdesk fn (never the RLS-locked hd_ tables).
 *
 * `articleId` is controlled by the shell so an AI-answer source link can open an
 * article here; null = show the folder list.
 */
export default function HelpBrowse({
  lang,
  articleId,
  onOpenArticle,
  onBack,
}: {
  lang: "cn" | "en";
  articleId: string | null;
  onOpenArticle: (id: string) => void;
  onBack: () => void;
}) {
  if (articleId) return <ArticleReader lang={lang} id={articleId} onBack={onBack} />;
  return <FolderList lang={lang} onOpenArticle={onOpenArticle} />;
}

function FolderList({ lang, onOpenArticle }: { lang: "cn" | "en"; onOpenArticle: (id: string) => void }) {
  const [folders, setFolders] = useState<HelpFolder[]>([]);
  const [articles, setArticles] = useState<HelpArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listFolders(), listArticles()])
      .then(([f, a]) => {
        if (cancelled) return;
        setFolders(f);
        setArticles(a);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : lang === "cn" ? "加载失败" : "Failed to load");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? articles.filter((a) => a.title.toLowerCase().includes(q)) : articles;
    const byFolder = new Map<string, HelpArticleListItem[]>();
    const uncategorized: HelpArticleListItem[] = [];
    for (const a of filtered) {
      if (a.folder_id) {
        const arr = byFolder.get(a.folder_id) || [];
        arr.push(a);
        byFolder.set(a.folder_id, arr);
      } else {
        uncategorized.push(a);
      }
    }
    const ordered = folders
      .map((f) => ({ folder: f, items: byFolder.get(f.id) || [] }))
      .filter((g) => g.items.length > 0);
    return { ordered, uncategorized, total: filtered.length };
  }, [folders, articles, query]);

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (err) {
    return <div className="glass-card rounded-2xl p-6 text-sm">{lang === "cn" ? "加载失败：" : "Failed: "}{err}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={lang === "cn" ? "搜索教程标题…" : "Search guides…"}
          className="pl-9"
        />
      </div>

      {groups.total === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">
          {query
            ? lang === "cn"
              ? "没有匹配的教程。"
              : "No matching guides."
            : lang === "cn"
              ? "还没有教程内容。"
              : "No guides yet."}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.ordered.map(({ folder, items }) => (
            <FolderBlock key={folder.id} title={folder.name} items={items} onOpenArticle={onOpenArticle} />
          ))}
          {groups.uncategorized.length > 0 && (
            <FolderBlock
              title={lang === "cn" ? "其他" : "Other"}
              items={groups.uncategorized}
              onOpenArticle={onOpenArticle}
            />
          )}
        </div>
      )}
    </div>
  );
}

function FolderBlock({
  title,
  items,
  onOpenArticle,
}: {
  title: string;
  items: HelpArticleListItem[];
  onOpenArticle: (id: string) => void;
}) {
  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <FolderOpen className="w-4 h-4 text-primary shrink-0" />
        <h3 className="font-display font-semibold text-sm">{title}</h3>
        <span className="text-xs text-muted-foreground">· {items.length}</span>
      </div>
      <div className="flex flex-col divide-y divide-border/40">
        {items.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onOpenArticle(a.id)}
            className="flex items-center gap-2.5 py-2.5 text-left hover:text-primary transition-colors group"
          >
            <FileText className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
            <span className="text-sm flex-1 min-w-0 truncate">{a.title}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ArticleReader({ lang, id, onBack }: { lang: "cn" | "en"; id: string; onBack: () => void }) {
  const [article, setArticle] = useState<HelpArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    getArticle(id)
      .then((a) => {
        if (cancelled) return;
        setArticle(a);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : lang === "cn" ? "加载失败" : "Failed to load");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, lang]);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" /> {lang === "cn" ? "返回列表" : "Back to list"}
      </Button>

      {loading ? (
        <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : err || !article ? (
        <div className="glass-card rounded-2xl p-6 text-sm">
          {lang === "cn" ? "加载失败：" : "Failed: "}
          {err ?? (lang === "cn" ? "无数据" : "no data")}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl font-display font-bold mb-1">{article.title}</h1>
          {article.category && <p className="text-xs text-muted-foreground mb-5">{article.category}</p>}
          {article.content?.trim() ? (
            <Markdown>{article.content}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">
              {lang === "cn" ? "（这篇教程还没有正文内容。）" : "(This guide has no content yet.)"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
