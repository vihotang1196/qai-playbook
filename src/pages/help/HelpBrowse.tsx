import { useEffect, useState } from "react";
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
 * 浏览教程 tab — TWO-LEVEL browse of the shared knowledge base:
 *   L1 category home  → a card per folder (name + article count)
 *   L2 folder articles → that folder's article list (+ back to categories)
 *   L3 article reader  → read one article (+ back to where you were)
 * Searching from L1 shows matching articles flat (cross-category). Reads through
 * the PUBLIC helpdesk fn (never the RLS-locked hd_ tables).
 *
 * `articleId` is controlled by the shell so an AI-answer source link can open an
 * article here. The selected folder lives HERE (not in a child) so returning
 * from an article lands back on the folder you were browsing, not the home.
 */

const UNCAT = "__uncategorized__"; // sentinel folder key for articles with no folder

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
  const [folders, setFolders] = useState<HelpFolder[]>([]);
  const [articles, setArticles] = useState<HelpArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null); // folder.id | UNCAT | null

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

  // ── L3: article reader (shell-controlled) — folder context is preserved in
  //    selectedKey, so onBack returns to whatever level we came from. ──
  if (articleId) return <ArticleReader lang={lang} id={articleId} onBack={onBack} />;

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

  const countFor = (key: string) =>
    articles.filter((a) => (key === UNCAT ? !a.folder_id : a.folder_id === key)).length;

  const q = query.trim().toLowerCase();

  // ── Search results (flat, cross-category) — takes priority over the levels ──
  if (q) {
    const results = articles.filter((a) => a.title.toLowerCase().includes(q));
    return (
      <div className="space-y-4">
        <SearchBox value={query} onChange={setQuery} lang={lang} />
        {results.length === 0 ? (
          <Empty text={lang === "cn" ? "没有匹配的教程。" : "No matching guides."} />
        ) : (
          <div className="glass-card rounded-2xl p-2 sm:p-3">
            <div className="flex flex-col divide-y divide-border/40">
              {results.map((a) => (
                <ArticleRow key={a.id} title={a.title} onClick={() => onOpenArticle(a.id)} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── L2: a selected folder's articles ──
  if (selectedKey) {
    const isOther = selectedKey === UNCAT;
    const folder = folders.find((f) => f.id === selectedKey);
    const name = isOther ? (lang === "cn" ? "其他" : "Other") : folder?.name ?? "";
    const items = articles.filter((a) => (isOther ? !a.folder_id : a.folder_id === selectedKey));
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => setSelectedKey(null)}>
          <ArrowLeft className="w-4 h-4" /> {lang === "cn" ? "返回分类" : "Back to categories"}
        </Button>
        <div className="glass-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen className="w-4 h-4 text-foreground shrink-0" />
            <h3 className="font-display font-semibold">{name}</h3>
            <span className="text-xs text-muted-foreground">· {items.length}</span>
          </div>
          <div className="flex flex-col divide-y divide-border/40">
            {items.map((a) => (
              <ArticleRow key={a.id} title={a.title} onClick={() => onOpenArticle(a.id)} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── L1: category home (folders with ≥1 article + an "Other" card) ──
  const cats = folders
    .map((f) => ({ key: f.id, name: f.name, count: countFor(f.id) }))
    .filter((c) => c.count > 0);
  const otherCount = countFor(UNCAT);

  return (
    <div className="space-y-4">
      <SearchBox value={query} onChange={setQuery} lang={lang} />
      {cats.length === 0 && otherCount === 0 ? (
        <Empty text={lang === "cn" ? "还没有教程内容。" : "No guides yet."} />
      ) : (
        <div className="space-y-2.5">
          {cats.map((c) => (
            <CategoryCard key={c.key} name={c.name} count={c.count} lang={lang} onClick={() => setSelectedKey(c.key)} />
          ))}
          {otherCount > 0 && (
            <CategoryCard
              name={lang === "cn" ? "其他" : "Other"}
              count={otherCount}
              lang={lang}
              onClick={() => setSelectedKey(UNCAT)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SearchBox({ value, onChange, lang }: { value: string; onChange: (v: string) => void; lang: "cn" | "en" }) {
  return (
    <div className="relative">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={lang === "cn" ? "搜索教程标题…" : "Search guides…"}
        className="pl-9"
      />
    </div>
  );
}

/** L1 category card — folder name + article count + chevron (image-4 style). */
function CategoryCard({
  name,
  count,
  lang,
  onClick,
}: {
  name: string;
  count: number;
  lang: "cn" | "en";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full glass-card rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left hover:bg-muted/40 transition-colors group"
    >
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <FolderOpen className="w-4 h-4 text-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display font-semibold text-sm truncate">{name}</p>
        <p className="text-xs text-muted-foreground">
          {count} {lang === "cn" ? "篇教程" : `article${count === 1 ? "" : "s"}`}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0" />
    </button>
  );
}

function ArticleRow({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 py-2.5 px-1.5 text-left hover:text-foreground transition-colors group"
    >
      <FileText className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0" />
      <span className="text-sm flex-1 min-w-0 truncate">{title}</span>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">{text}</div>;
}

function ArticleReader({ lang, id, onBack }: { lang: "cn" | "en"; id: string; onBack: () => void }) {
  const [article, setArticle] = useState<HelpArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  /** The article is gone, as opposed to unreachable — a different message and no
   *  retry. The edge fn answers a missing id with the literal "not_found". */
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setGone(false);
    getArticle(id)
      .then((a) => {
        if (cancelled) return;
        setArticle(a);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        const raw = e instanceof Error ? e.message : "";
        if (raw === "not_found") setGone(true);
        else setErr(raw || (lang === "cn" ? "加载失败" : "Failed to load"));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, lang]);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" /> {lang === "cn" ? "返回" : "Back"}
      </Button>

      {loading ? (
        <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : gone ? (
        // A deleted guide is not a failure the reader can retry, and showing the
        // raw "not_found" from the edge fn told them nothing. Reachable from an
        // AI answer's source button, which now also comes back with replayed
        // history — so links months old can point at articles since removed.
        <div className="glass-card rounded-2xl p-6 text-sm space-y-3">
          <p>
            {lang === "cn"
              ? "这篇指南已不存在，可能已被移除或合并。"
              : "This guide no longer exists — it may have been removed or merged."}
          </p>
          <Button variant="outline" size="sm" onClick={onBack}>
            {lang === "cn" ? "浏览其他教程" : "Browse other guides"}
          </Button>
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
