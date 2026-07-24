import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { GUIDES, getGuide } from "./guides";

/**
 * Full-page guide (`/guides/:slug`) — replaces the cramped navbar hover-popout.
 * Inside <Layout>, so it wears the Playbook navbar/footer. Public (no location
 * gate) — these are general help guides, not customer-scoped content.
 */
export default function GuidePage() {
  const { slug } = useParams();
  const { lang } = useLang();
  const guide = slug ? getGuide(slug) : undefined;

  return (
    <div className="px-4 sm:px-6 pb-16 pt-24 md:pt-28">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> {lang === "cn" ? "返回首页" : "Back to home"}
        </Link>

        {!guide ? (
          <div className="glass-card rounded-2xl p-8 text-center">
            <h1 className="text-xl font-display font-bold mb-2">{lang === "cn" ? "指南未找到" : "Guide not found"}</h1>
            <p className="text-sm text-muted-foreground mb-5">
              {lang === "cn" ? "这个指南不存在或已移动。看看这些：" : "This guide doesn't exist or has moved. Try these:"}
            </p>
            <div className="flex flex-col items-center gap-2">
              {GUIDES.map((g) => (
                <Link key={g.slug} to={`/guides/${g.slug}`} className="text-sm text-primary hover:underline">
                  {g.title[lang]}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          (() => {
            const Content = guide.Content;
            return (
              <article className="glass-card rounded-2xl p-6 sm:p-8">
                <h1 className="text-2xl font-display font-bold mb-5">{guide.title[lang]}</h1>
                <Content lang={lang} />
              </article>
            );
          })()
        )}
      </div>
    </div>
  );
}
