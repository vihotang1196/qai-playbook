import { Link } from "react-router-dom";
import { ArrowLeft, Star, Wrench } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

/**
 * Phase 0 scaffold placeholder for every Review Boost page.
 *
 * Two variants:
 *  - default (admin): rendered INSIDE the shared <Layout> (global navbar +
 *    ambient background already present), so it only paints content.
 *  - `public`: rendered OUTSIDE <Layout> (scan / thank-you pages), so it owns
 *    a full-screen mobile-first coral background of its own.
 *
 * Each phase replaces the relevant stub with the real page.
 */
type RBStubProps = {
  title: string;
  subtitle?: string;
  phase: string;
  /** Full-screen public variant (scan / thank-you). */
  isPublic?: boolean;
};

export default function RBStub({ title, subtitle, phase, isPublic = false }: RBStubProps) {
  const { lang } = useLang();
  const soon = lang === "cn" ? "施工中" : "Coming soon";

  const inner = (
    <div className="glass-card rounded-3xl p-8 sm:p-10 max-w-md w-full text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-white"
        style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
      >
        <Star className="w-6 h-6" />
      </div>
      <div className="vision-chip mx-auto mb-4">
        <Wrench className="w-3 h-3" />
        {soon} · {phase}
      </div>
      <h1 className="text-2xl font-display font-bold mb-2">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground leading-relaxed">{subtitle}</p>}
      {!isPublic && (
        <Link
          to="/review-boost"
          className="inline-flex items-center gap-1.5 mt-6 text-sm font-medium text-primary hover:opacity-80 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" />
          {lang === "cn" ? "返回 Review Boost" : "Back to Review Boost"}
        </Link>
      )}
    </div>
  );

  if (isPublic) {
    // Public pages live outside the shared Layout — paint our own coral,
    // mobile-first, full-screen background.
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 bg-[#FCFDFF]">
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute -top-24 -left-16 w-80 h-80 rounded-full bg-[#FFB199]/40 blur-[90px]" />
          <div className="absolute top-1/3 -right-16 w-72 h-72 rounded-full bg-[#FFC7D1]/40 blur-[90px]" />
          <div className="absolute -bottom-24 left-1/4 w-80 h-80 rounded-full bg-[#DCE6FF]/40 blur-[90px]" />
        </div>
        {inner}
      </div>
    );
  }

  return <div className="min-h-screen flex items-center justify-center px-6 pt-24 pb-16">{inner}</div>;
}
