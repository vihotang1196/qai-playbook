import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, Copy, LifeBuoy, Lock, Megaphone, MessageCircle } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { resolveLocationId, resolveStaff, fetchLocation, inIframe, type GhlLocation } from "@/lib/ghl";
import { checkHelpAccess } from "@/lib/helpdesk";
import HelpChat from "./HelpChat";
import HelpBrowse, { ArticleReader } from "./HelpBrowse";
import HelpUpdates from "./HelpUpdates";

/**
 * Public customer HELP CENTER (`/help`) — QAI's shared, agency-wide help center:
 * AI 问答 + 浏览教程 + 更新, three tabs.
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

/** Reading column, single-pane (≈ max-w-3xl, what this page has always been). */
const SINGLE_MAX_W = 768;
/** Reading column while split. At 3fr/2fr this is ≈ 797px of guide + 531px of
 *  chat — the guide gets the larger share because it is prose with screenshots,
 *  while the chat only needs room for bubbles and a composer. Below ~1200 the
 *  chat side starts wrapping its toolbar, which is why this is not smaller. */
const SPLIT_MAX_W = 1400;

/** Everything above the split row: fixed navbar, page top padding, the header
 *  block, the tab bar and their margins. Subtracted from the viewport so each
 *  pane scrolls internally instead of the page scrolling — otherwise reading a
 *  long guide would push the chat's composer off screen and undo the split. */
const SPLIT_CHROME_PX = 300;

/**
 * ⚠️ EXTRA HEIGHT RESERVED WHEN FRAMED — tune THIS LINE from real observation.
 *
 * Inside the GHL iframe, `100vh` measures the IFRAME's viewport, and on desktop
 * that frame runs TALLER than the parent's visible area. Everything measured from
 * inside the frame therefore looks correct while the bottom of the page sits
 * below the fold. This is the same trap that half-hid the Offline Event confirm
 * bar (see IFRAME_BAR_BOTTOM_OFFSET in pages/events/EventsPage.tsx and PROGRESS)
 * — the failure here is worse, because what lands below the fold is the chat's
 * text input: invisible AND unclickable.
 *
 * There is no way to measure the real visible height from in here. The parent is
 * cross-origin, so `window.parent` is unreadable; `visualViewport`,
 * `ResizeObserver` and IntersectionObserver all report the iframe's own box; and
 * GHL exposes no postMessage channel (already established — do not re-litigate).
 * So it is a constant, verified by eye on a real GHL desktop session.
 *
 * Deliberately NOT a fixed pixel height for the framed case: subtracting extra
 * from the viewport still adapts when the browser window changes size, whereas a
 * hardcoded 620px would overflow a short window and waste a tall one.
 *
 * If the input sits too low → raise this. If there is a dead band under the
 * panes → lower it. Standalone is unaffected and must not be "fixed" with it.
 */
const IFRAME_OVERSHOOT_PX = 120;

/** Height of the split row. Floor via lg:min-h-[420px] on the element. */
const splitHeight = (framed: boolean) =>
  `calc(100vh - ${SPLIT_CHROME_PX + (framed ? IFRAME_OVERSHOOT_PX : 0)}px)`;

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
  /** Which tab the reader was on when they opened the current guide — see
   *  closeArticle. Only meaningful while articleId is set. */
  const [originTab, setOriginTab] = useState<Tab>("chat");
  const framed = useRef(inIframe()).current;
  const articleScrollRef = useRef<HTMLDivElement>(null);

  /** A guide is open → desktop shows it beside the chat instead of instead of it. */
  const split = articleId !== null;

  // Open a KB article. From an AI answer's source link this no longer navigates
  // away from the conversation: on desktop the guide opens in the left pane and
  // the chat stays put on the right, which is the point of the split.
  function openArticle(id: string) {
    // Only on the FIRST open — following a source link from inside an already
    // open guide must not overwrite where the reader originally came from.
    if (articleId === null) setOriginTab(tab);
    setArticleId(id);
  }

  /** Closing returns to the tab the guide was opened from: arriving via a chat
   *  source link and arriving via the guide list are different journeys, and each
   *  one's "back" is a different place. */
  function closeArticle() {
    setArticleId(null);
    setTab(originTab);
  }

  // A second guide opened from inside the first must start at ITS top, not
  // wherever the previous one was scrolled to. Assigns scrollTop on the pane
  // rather than calling scrollIntoView, which walks up to the document and would
  // drag the whole page (see the CoursePlayer note in PROGRESS).
  useEffect(() => {
    if (articleScrollRef.current) articleScrollRef.current.scrollTop = 0;
  }, [articleId]);

  // No location_id → the "open from QAI" gate (mirrors RB's no-location state).
  if (!locationId) return <OpenFromQai lang={lang} />;
  // Not switched on for this sub-account (内测中 whitelist / admin toggle).
  if (allowed === false) return <HelpNotEnabled lang={lang} />;

  const businessName = location?.business_name?.trim();

  const tabs: { key: Tab; label: string; icon: typeof MessageCircle }[] = [
    { key: "chat", label: lang === "cn" ? "AI 问答" : "AI Chat", icon: MessageCircle },
    { key: "browse", label: lang === "cn" ? "浏览教程" : "Guides", icon: BookOpen },
    { key: "updates", label: lang === "cn" ? "更新" : "Updates", icon: Megaphone },
  ];

  // The chat pane is on screen whenever a guide is open, whatever tab says.
  const chatVisible = split || tab === "chat";
  // While reading, 浏览教程 is the honest highlight: that is the task, and the
  // chat alongside it is a companion pane rather than the current tab.
  const activeTab: Tab = split ? "browse" : tab;

  return (
    <div className="px-4 sm:px-6 pb-16 pt-24 md:pt-28">
      {/* The column widens for the split (768 → 1400) and narrows back. Both this
          and the track sizes below animate as plain lengths, which is the whole
          reason the layout is built this way — see the grid comment. */}
      <div
        className="mx-auto transition-[max-width] duration-300 ease-out"
        style={{ maxWidth: split ? SPLIT_MAX_W : SINGLE_MAX_W }}
      >
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
              {businessName || (lang === "cn" ? "AI 问答 · 浏览教程 · 更新" : "AI Chat · Guides · Updates")}
            </p>
          </div>
        </div>

        {/* Tabs — full-width segmented bar: 3 equal columns filling the container. */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {tabs.map((t) => {
            const active = activeTab === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                // Tabs stay live during the split and any of them leaves it. The
                // tab bar always means "what this page is showing"; reading a
                // guide is a state of that, not an escape from it.
                onClick={() => {
                  setArticleId(null);
                  setTab(t.key);
                }}
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

        {/*
          SPLIT LAYOUT — two tracks, always both present.

          Animating between one and two columns is only possible because BOTH
          states declare two tracks and differ just in their fr values, which
          interpolate. `display` cannot be transitioned, a track cannot be added
          mid-animation, and `width: auto` is not a length — this is the one
          shape CSS will actually tween.

          Three consequences of keeping a 0fr track, all load-bearing:
            · `min-w-0` — a grid track floors at its content's min-content width,
              so without it "0fr" is really "as narrow as the longest word".
            · `overflow-hidden` — content must be clipped while the track shrinks.
            · `visibility` — a zero-width pane is still focusable and still read
              aloud. Hiding it fixes both, which `aria-hidden` alone would not
              (that stops screen readers and leaves Tab going in). It is delayed
              by the animation on the way out so the guide does not vanish before
              its pane has finished closing. Chosen over `inert`, which browsers
              support fine but React 18 does not type or forward.

          Below lg there is no split: `display` is block, the two children swap by
          class, and a guide simply replaces the page as it always has.
        */}
        <div
          className="lg:grid lg:gap-6 lg:h-[var(--split-h)] lg:min-h-[420px]"
          style={{
            gridTemplateColumns: split ? "3fr 2fr" : "0fr 2fr",
            transition: "grid-template-columns 300ms ease-out",
            ["--split-h" as string]: splitHeight(framed),
          }}
        >
          {/* Guide pane */}
          <div
            className={`${split ? "block" : "hidden"} lg:block min-w-0 overflow-hidden lg:h-full`}
            style={{
              visibility: split ? "visible" : "hidden",
              transition: `visibility 0s linear ${split ? "0ms" : "300ms"}`,
            }}
          >
            <div ref={articleScrollRef} className="lg:h-full lg:overflow-y-auto lg:pr-1">
              {articleId && (
                <ArticleReader lang={lang} id={articleId} onBack={closeArticle} />
              )}
            </div>
          </div>

          {/* Chat / browse / updates pane */}
          <div className={`${split ? "hidden lg:block" : "block"} min-w-0 lg:h-full`}>
            {/* HelpChat is mounted for the page's whole life and only hidden.
                Remounting it on every tab or split change would throw away
                half-typed input and an in-flight request, and would visibly
                re-fetch the thread each time. */}
            <div className={`${chatVisible ? "block" : "hidden"} h-[68vh] min-h-[420px] lg:h-full`}>
              <HelpChat
                lang={lang}
                locationId={locationId}
                staffEmail={staff.email}
                staffName={staff.name}
                onOpenArticle={openArticle}
                visible={chatVisible}
              />
            </div>
            {!split && tab === "browse" && (
              <HelpBrowse
                lang={lang}
                articleId={null}
                onOpenArticle={openArticle}
                onBack={closeArticle}
              />
            )}
            {!split && tab === "updates" && <HelpUpdates lang={lang} />}
          </div>
        </div>
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
