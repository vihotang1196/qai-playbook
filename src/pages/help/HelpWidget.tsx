import { useEffect, useState } from "react";
import { BookOpen, LifeBuoy, Megaphone, MessageCircle } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { resolveLocationId, fetchLocation, type GhlLocation } from "@/lib/ghl";
import HelpChat from "./HelpChat";
import HelpBrowse from "./HelpBrowse";
import HelpUpdates from "./HelpUpdates";

/**
 * Public customer HELP CENTER (`/help`) — QAI's shared, agency-wide help center:
 * AI 问答 + 浏览教程 + 产品更新, three tabs.
 *
 * Rendered INSIDE the shared <Layout> (like the Review Boost customer app), so
 * it wears the Playbook navbar + footer and feels like part of Playbook rather
 * than a bare standalone page. Layout provides the background + chrome — this
 * page renders none of its own; it only adds top padding to clear the fixed
 * navbar (same as the RB shell).
 *
 * Still restricted to GHL customers, trust-the-URL (WEAK) gate like Review
 * Boost: entered via a GHL Custom Menu Link that carries ?location_id=. No
 * location_id → a "请从 GHL 打开" block. Content is NOT location-scoped (same
 * shared KB for everyone); location_id only tags conversations for analytics.
 *
 * Identity REUSES Review Boost's low-level helpers (getLocationIdFromUrl +
 * fetchLocation from lib/ghl) — NOT the RB LocationProvider, which is bound to
 * RB's per-location tool-access check (checkRbAccess) the shared help center
 * doesn't have.
 */

type Tab = "chat" | "browse" | "updates";

/** Resolve the location_id (URL first, else the one stashed this tab session by
 *  LocationIdKeeper — so arriving via the navbar, which drops the query string,
 *  still keeps identity) + best-effort resolve the business name. The gate is
 *  presence of a location_id; name resolution is best-effort (a help center must
 *  not lock a real GHL user out over a transient lookup failure). */
function useHelpLocation() {
  const [locationId] = useState<string>(() => resolveLocationId());
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

export default function HelpWidget() {
  const { lang } = useLang();
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
      <div className="min-h-screen px-4 sm:px-6 pb-16 pt-24 md:pt-28">
        <div className="max-w-md mx-auto">
          <div className="glass-card rounded-3xl p-8 sm:p-10 text-center">
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
          </div>
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
    <div className="min-h-screen px-4 sm:px-6 pb-16 pt-24 md:pt-28">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #FF7E5F, #FF3D6E)" }}
          >
            <LifeBuoy className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-display font-bold leading-tight">
              {lang === "cn" ? "帮助中心" : "Help Center"}
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              {businessName || (lang === "cn" ? "AI 问答 · 浏览教程 · 产品更新" : "AI Chat · Guides · Updates")}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-4">
          {tabs.map((t) => {
            const active = tab === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground shadow-sm" : "glass-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        {tab === "chat" ? (
          <div className="h-[68vh] min-h-[420px]">
            <HelpChat lang={lang} locationId={locationId} onOpenArticle={openArticle} />
          </div>
        ) : tab === "browse" ? (
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
  );
}
