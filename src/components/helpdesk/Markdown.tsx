import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Shared markdown renderer for the Helpdesk — used by the article editor's live
 * preview (P3) and later by the public widget (P6). Renders to React elements
 * with NO raw-HTML pass-through, so it is XSS-safe for both admin-entered and
 * Notion-imported content. Styled via the Tailwind typography (`prose`) plugin.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none prose-headings:font-display prose-headings:font-semibold prose-a:text-primary prose-img:rounded-xl prose-pre:bg-muted/60">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children || ""}</ReactMarkdown>
    </div>
  );
}
