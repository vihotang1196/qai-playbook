import { useState, type ComponentType } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Shared "open this tool from your QAI dashboard" gate.
 *
 * Every tool that identifies its user by the GHL location_id in the URL shows
 * this when there is no location_id: without one we can't tell whose account it
 * is, so the tool can't run (and — since these endpoints cost real money — must
 * not run). Same posture as the Helpdesk / Review Boost / Offline Event gates.
 *
 * Those two older tools still carry their own inline copies of this block; this
 * component is the shared version new callers use, and they can adopt it later
 * without any behaviour change.
 */
const QAI_URL = "https://app.qiai.tech/";

export default function OpenFromQai({
  lang,
  icon: Icon,
  title,
  description,
}: {
  lang: "cn" | "en";
  icon: ComponentType<{ className?: string }>;
  title: { cn: string; en: string };
  description?: { cn: string; en: string };
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    // Legacy fallback for when the async Clipboard API is blocked (some embeds /
    // non-secure contexts). The link stays visible + clickable regardless.
    const fallback = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = QAI_URL;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        done();
      } catch {
        /* leave the link for manual copy */
      }
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(QAI_URL).then(done, fallback);
    else fallback();
  }

  const desc =
    description ??
    {
      cn: "请从你的 QAI 后台打开这个工具，这样才能识别你的账号。",
      en: "Please open this tool from your QAI dashboard so we can recognise your account.",
    };

  return (
    <div className="px-4 sm:px-6 pb-16 pt-24 md:pt-28">
      <div className="max-w-md mx-auto">
        <div className="glass-card rounded-3xl p-8 sm:p-10 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-[#fed50a]"
            style={{ background: "#141414" }}
          >
            <Icon className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-display font-bold mb-2">{title[lang]}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{desc[lang]}</p>

          <div className="mt-5 flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 p-1.5 pl-3">
            <a
              href={QAI_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-mono truncate flex-1 text-left text-[#141414] hover:underline"
            >
              {QAI_URL}
            </a>
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground border-2 border-[#141414] text-xs font-medium px-3 py-1.5 shrink-0 hover:opacity-90 transition-opacity"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? (lang === "cn" ? "已复制" : "Copied") : lang === "cn" ? "复制" : "Copy"}
            </button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {lang === "cn"
              ? "打开上面的网址登录 QAI，再从里面进入这个工具。"
              : "Open the link above, sign in to QAI, then enter this tool from there."}
          </p>
        </div>
      </div>
    </div>
  );
}
