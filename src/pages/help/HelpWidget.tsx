import { LifeBuoy, Wrench } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

/**
 * Public embeddable Helpdesk widget ("Angel AI") — QAI's SHARED help center:
 * knowledge base + AI chat + product updates in one panel, bilingual EN/中文.
 *
 * Rendered OUTSIDE the shared <Layout> (no site navbar/footer) so it can be
 * dropped into any site as an iframe, exactly like the Review Boost /scan page.
 *
 * Phase 0 scaffold. The real widget — ONE unified widget replacing the old
 * export's two drifted ones — lands in Phase 6, backed by the Claude tool-use
 * chat function (Phase 5) that actually reads the knowledge base (Phase 3–4).
 */
export default function HelpWidget() {
  const { lang } = useLang();

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 bg-[#FCFDFF]">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 -left-16 w-80 h-80 rounded-full bg-[#FFB199]/40 blur-[90px]" />
        <div className="absolute top-1/3 -right-16 w-72 h-72 rounded-full bg-[#FFC7D1]/40 blur-[90px]" />
        <div className="absolute -bottom-24 left-1/4 w-80 h-80 rounded-full bg-[#DCE6FF]/40 blur-[90px]" />
      </div>

      <div className="glass-card rounded-3xl p-8 sm:p-10 max-w-md w-full text-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-white"
          style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
        >
          <LifeBuoy className="w-6 h-6" />
        </div>
        <div className="vision-chip mx-auto mb-4">
          <Wrench className="w-3 h-3" />
          {lang === "cn" ? "施工中 · P6" : "Coming soon · P6"}
        </div>
        <h1 className="text-2xl font-display font-bold mb-2">
          {lang === "cn" ? "帮助中心" : "Help Center"}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {lang === "cn"
            ? "可嵌入的 AI 客服挂件——知识库 + AI 问答 + 产品更新，一个面板。"
            : "The embeddable AI support widget — knowledge base + AI chat + product updates in one panel."}
        </p>
      </div>
    </div>
  );
}
