import { useEffect, useState } from "react";
import { BookOpen, Check, Copy, LifeBuoy, Lock, Megaphone, MessageCircle } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { resolveLocationId, resolveStaff, fetchLocation, type GhlLocation } from "@/lib/ghl";
import { checkHelpAccess } from "@/lib/helpdesk";
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
  // null = still checking. Whether this sub-account may open the help center
  // (Admin Portal toggle / 内测中 whitelist). Fail-open inside checkHelpAccess.
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    fetchLocation(locationId)
      .then((loc) => !cancelled && setLocation(loc))
      .catch(() => {
        /* best-effort — content is shared, don't block on name resolution */
      });
    checkHelpAccess(locationId)
      .then((ok) => !cancelled && setAllowed(ok))
      .catch(() => !cancelled && setAllowed(true));
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  return { locationId, location, allowed };
}

export default function HelpWidget() {
  const { lang } = useLang();
  const { locationId, location, allowed } = useHelpLocation();
  // Need 2 — the GHL staff who's asking (from the menu-link merge fields), for
  // attribution. Read once (stable for the tab session), same as location_id.
  const [staff] = useState(() => resolveStaff());
  const [tab, setTab] = useState<Tab>("chat");
  const [articleId, setArticleId] = useState<string | null>(null);

  // Open a KB article inside the page (from an AI-answer source link).
  function openArticle(id: string) {
    setArticleId(id);
    setTab("browse");
  }

  // No location_id → the "open from QAI" gate (mirrors RB's no-location state).
  if (!locationId) return <OpenFromQai lang={lang} />;
  // Not switched on for this sub-account (内测中 whitelist / admin toggle).
  if (allowed === false) return <HelpNotEnabled lang={lang} />;

  const businessName = location?.business_name?.trim();

  const tabs: { key: Tab; label: string; icon: typeof MessageCircle }[] = [
    { key: "chat", label: lang === "cn" ? "AI 问答" : "AI Chat", icon: MessageCircle },
    { key: "browse", label: lang === "cn" ? "浏览教程" : "Guides", icon: BookOpen },
    { key: "updates", label: lang === "cn" ? "产品更新" : "Updates", icon: Megaphone },
  ];

  return (
    <div className="px-4 sm:px-6 pb-16 pt-24 md:pt-28">
      {/* Centered column (max-w-3xl ≈ 768px) — wide enough to feel roomy; shared
          by all three tabs (header + full-width tab bar + content). */}
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-[#fed50a] shrink-0"
            style={{ background: "#141414" }}
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

        {/* Tabs — full-width segmented bar: 3 equal columns filling the container. */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {tabs.map((t) => {
            const active = tab === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
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
            <HelpChat
              lang={lang}
              locationId={locationId}
              staffEmail={staff.email}
              staffName={staff.name}
              onOpenArticle={openArticle}
            />
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

const QAI_URL = "https://app.qiai.tech/";

/** Shown when there's no identity (not opened from QAI). Customers know the QAI
 *  brand, not GHL — so this points them to app.qiai.tech with a copyable link. */
/** Help center not switched on for this sub-account yet (内测中 whitelist or an
 *  explicit Admin Portal toggle). Same wording style as the other tools', and it
 *  reads correctly in both rollout modes. */
function HelpNotEnabled({ lang }: { lang: "cn" | "en" }) {
  return (
    <div className="px-4 sm:px-6 pb-16 pt-24 md:pt-28">
      <div className="max-w-md mx-auto">
        <div className="glass-card rounded-3xl p-8 sm:p-10 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-[#fed50a]"
            style={{ background: "#141414" }}
          >
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-display font-bold mb-2">
            {lang === "cn" ? "帮助中心" : "Help Center"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lang === "cn"
              ? "帮助中心尚未对你的账号开放。如需开通，请联系 QAI 管理员。"
              : "The help center isn't enabled for your account yet. Please contact your QAI admin to enable it."}
          </p>
        </div>
      </div>
    </div>
  );
}

function OpenFromQai({ lang }: { lang: "cn" | "en" }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    // Legacy fallback for when the async Clipboard API is blocked (some embeds /
    // non-secure contexts). The link is also visible + clickable regardless.
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
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(QAI_URL).then(done, fallback);
    } else {
      fallback();
    }
  }
  return (
    <div className="px-4 sm:px-6 pb-16 pt-24 md:pt-28">
      <div className="max-w-md mx-auto">
        <div className="glass-card rounded-3xl p-8 sm:p-10 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-[#fed50a]"
            style={{ background: "#141414" }}
          >
            <LifeBuoy className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-display font-bold mb-2">{lang === "cn" ? "帮助中心" : "Help Center"}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lang === "cn"
              ? "请从你的 QAI 后台打开帮助中心，这样才能识别你的账号。"
              : "Please open the Help Center from your QAI dashboard so we can recognise your account."}
          </p>

          {/* Copyable QAI link */}
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 p-1.5 pl-3">
            <a
              href={QAI_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-mono truncate flex-1 text-left text-foreground hover:underline"
            >
              {QAI_URL}
            </a>
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 shrink-0 hover:opacity-90 transition-opacity"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? (lang === "cn" ? "已复制" : "Copied") : (lang === "cn" ? "复制" : "Copy")}
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {lang === "cn"
              ? "打开上面的网址登录 QAI，再从里面进入帮助中心。"
              : "Open the link above, sign in to QAI, then enter the Help Center from there."}
          </p>
        </div>
      </div>
    </div>
  );
}
