import { useEffect, useState } from "react";
import { BookOpen, LifeBuoy, Megaphone, MessageCircle } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { getLocationIdFromUrl, fetchLocation, type GhlLocation } from "@/lib/ghl";
import HelpChat from "./HelpChat";
import HelpBrowse from "./HelpBrowse";
import HelpUpdates from "./HelpUpdates";

/**
 * Public customer HELP CENTER (`/help`) — QAI's shared, agency-wide help center
 * in one full-screen page: AI 问答 + 浏览教程 + 产品更新. Rendered OUTSIDE the
 * shared <Layout> (no site navbar/footer) so it embeds cleanly in a GHL iframe,
 * exactly like the Review Boost /scan page.
 *
 * Access = restricted to GHL customers, trust-the-URL (WEAK) gate like Review
 * Boost: entered via a GHL Custom Menu Link that carries ?location_id=. No
 * location_id → a "请从 GHL 打开" screen. The content itself is NOT
 * location-scoped (it's the same shared KB for everyone); the location_id only
 * tags conversations for analytics.
 *
 * Identity REUSES Review Boost's low-level helpers (getLocationIdFromUrl +
 * fetchLocation from lib/ghl) — NOT the RB LocationProvider, which is bound to
 * RB's per-location tool-access check (checkRbAccess) that the shared help
 * center doesn't have.
 */

type Tab = "chat" | "browse" | "updates";

/** Read the URL location_id + best-effort resolve the business name. The gate is
 *  presence of a location_id; name resolution is best-effort (a help center must
 *  not lock a real GHL user out over a transient lookup failure). */
function useHelpLocation() {
  const [locationId] = useState<string>(() => getLocationIdFromUrl());
  const [location, setLocation] = useState<GhlLocation | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    fetchLocation(locationId)
      .then((loc) => !cancelled && setLocation(loc))
      .catch(() => {
        /* best-effort — content is shared, don't block on name resolution */
      });
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  return { locationId, location };
}

function AmbientBg() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute -top-24 -left-16 w-80 h-80 rounded-full bg-[#FFB199]/40 blur-[90px]" />
      <div className="absolute top-1/3 -right-16 w-72 h-72 rounded-full bg-[#FFC7D1]/40 blur-[90px]" />
      <div className="absolute -bottom-24 left-1/4 w-80 h-80 rounded-full bg-[#DCE6FF]/40 blur-[90px]" />
    </div>
  );
}

export default function HelpWidget() {
  const { lang, toggleLang } = useLang();
  const { locationId, location } = useHelpLocation();
  const [tab, setTab] = useState<Tab>("chat");
  const [articleId, setArticleId] = useState<string | null>(null);

  // Open a KB article inside the page (from an AI-answer source link).
  function openArticle(id: string) {
    setArticleId(id);
    setTab("browse");
  }

  // No location_id → the "open from GHL" gate (mirrors RB's no-location state).
  if (!locationId) {
    return (
      <div className="min-h-[100dvh] relative overflow-hidden flex items-center justify-center p-4 bg-[#FCFDFF]">
        <AmbientBg />
        <div className="glass-card rounded-3xl p-8 sm:p-10 max-w-md w-full text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-white"
            style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
          >
            <LifeBuoy className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-display font-bold mb-2">{lang === "cn" ? "帮助中心" : "Help Center"}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lang === "cn"
              ? "请从你的 GoHighLevel 后台打开帮助中心。"
              : "Please open the Help Center from your GoHighLevel dashboard."}
          </p>
          <button
            onClick={toggleLang}
            className="mt-5 text-xs text-primary hover:opacity-80"
          >
            {lang === "cn" ? "English" : "中文"}
          </button>
        </div>
      </div>
    );
  }

  const businessName = location?.business_name?.trim();

  const tabs: { key: Tab; label: string; icon: typeof MessageCircle }[] = [
    { key: "chat", label: lang === "cn" ? "AI 问答" : "AI Chat", icon: MessageCircle },
    { key: "browse", label: lang === "cn" ? "浏览教程" : "Guides", icon: BookOpen },
    { key: "updates", label: lang === "cn" ? "产品更新" : "Updates", icon: Megaphone },
  ];

  return (
    <div className="h-[100dvh] relative overflow-hidden flex flex-col bg-[#FCFDFF]">
      <AmbientBg />

      {/* Header */}
      <header className="shrink-0 border-b border-border/40 bg-white/50 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
          >
            <LifeBuoy className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-bold leading-tight truncate">
              {lang === "cn" ? "帮助中心" : "Help Center"}
            </h1>
            {businessName && <p className="text-xs text-muted-foreground truncate">{businessName}</p>}
          </div>
          <button
            onClick={toggleLang}
            className="text-xs text-primary hover:opacity-80 shrink-0 px-2 py-1 rounded-lg hover:bg-primary/5"
          >
            {lang === "cn" ? "English" : "中文"}
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-3xl mx-auto px-4 pb-2 flex gap-1.5">
          {tabs.map((t) => {
            const active = tab === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 min-h-0">
        {tab === "chat" ? (
          <div className="h-full max-w-3xl mx-auto px-4 py-4 flex flex-col min-h-0">
            <HelpChat lang={lang} locationId={locationId} onOpenArticle={openArticle} />
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-4">
              {tab === "browse" ? (
                <HelpBrowse
                  lang={lang}
                  articleId={articleId}
                  onOpenArticle={openArticle}
                  onBack={() => setArticleId(null)}
                />
              ) : (
                <HelpUpdates lang={lang} />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
