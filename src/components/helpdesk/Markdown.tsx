import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const VIDEO_RE = /\.(mp4|webm|mov|m4v)(\?|$)/i;

/**
 * Shared markdown renderer for the Helpdesk — used by the article editor's live
 * preview (P3) and later by the public widget (P6). Renders to React elements
 * with NO raw-HTML pass-through, so it is XSS-safe for both admin-entered and
 * Notion-imported content. Styled via the Tailwind typography (`prose`) plugin.
 *
 * Links to a video file (Notion videos, persisted to Storage as `[📹 …](url.mp4)`)
 * render as an inline <video> player; other links open in a new tab.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none prose-headings:font-display prose-headings:font-semibold prose-a:text-primary prose-img:rounded-xl prose-pre:bg-muted/60">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) =>
            href && VIDEO_RE.test(href) ? (
              <video src={href} controls className="rounded-xl max-w-full" />
            ) : (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
        }}
      >
        {children || ""}
      </ReactMarkdown>
    </div>
  );
}
