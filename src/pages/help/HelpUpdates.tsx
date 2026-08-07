import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Megaphone } from "lucide-react";
import { listUpdates, type HelpUpdate } from "@/lib/helpdesk";
import Markdown from "@/components/helpdesk/Markdown";

/**
 * 更新 tab — the latest product-update posts (hd_updates), newest first.
 * Published from the Admin Portal (P8). Each shows title + date + markdown body
 * + optional image + optional "了解更多" link. Read via the public helpdesk fn.
 */
export default function HelpUpdates({ lang }: { lang: "cn" | "en" }) {
  const [updates, setUpdates] = useState<HelpUpdate[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listUpdates()
      .then((u) => !cancelled && setUpdates(u))
      .catch((e) => !cancelled && setErr(e instanceof Error ? e.message : lang === "cn" ? "加载失败" : "Failed to load"));
    return () => {
      cancelled = true;
    };
  }, [lang]);

  if (err) {
    return <div className="glass-card rounded-2xl p-6 text-sm">{lang === "cn" ? "加载失败：" : "Failed: "}{err}</div>;
  }

  if (!updates) {
    return (
      <div className="glass-card rounded-2xl p-10 flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#fed50a]"
          style={{ background: "#141414" }}
        >
          <Megaphone className="w-6 h-6" />
        </div>
        <h3 className="font-display font-semibold mb-1">{lang === "cn" ? "更新" : "Updates"}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          {lang === "cn" ? "暂时还没有更新，敬请期待。" : "No updates yet. Stay tuned."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {updates.map((u) => (
        <article key={u.id} className="glass-card rounded-2xl p-5 sm:p-6">
          <p className="text-xs text-muted-foreground mb-1">
            {new Date(u.created_at).toLocaleDateString(lang === "cn" ? "zh-CN" : "en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
          <h2 className="text-lg font-display font-bold mb-3">{u.title}</h2>
          {u.image_url && (
            <img src={u.image_url} alt="" className="rounded-xl max-w-full mb-3" loading="lazy" />
          )}
          {u.description?.trim() && <Markdown>{u.description}</Markdown>}
          {u.link && (
            <a
              href={u.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-sm text-foreground hover:opacity-80"
            >
              {lang === "cn" ? "了解更多" : "Learn more"} <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </article>
      ))}
    </div>
  );
}
