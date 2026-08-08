import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, Copy, LifeBuoy, Lock, Megaphone, MessageCircle, X } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { resolveLocationId, resolveStaff, fetchLocation, inIframe, type GhlLocation } from "@/lib/ghl";
import { checkHelpAccess } from "@/lib/helpdesk";
import HelpChat from "./HelpChat";
import HelpBrowse, { ArticleReader } from "./HelpBrowse";
import HelpUpdates from "./HelpUpdates";
import { Button } from "@/components/ui/button";

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

/** Reading column, single pane — what this page has always been. */
const SINGLE_MAX_W = 768;
/**
 * Reading column while the split is open. The real GHL frame measures 2083px
 * wide (?hdDebug=1), so 1400 was leaving ~340px empty down each side while the
 * chat sat at a cramped 550. At 1700 the margins are ~165 a side and both panes
 * grow — the chat was widened by using the empty space, not by taking any from
 * the guide.
 *
 * SPLIT_COLS must stay pure `fr` on BOTH sides. Something like
 * `minmax(0,880px) 1fr` would cap the guide more directly, but a track list can
 * only be tweened against another of the same types, and the collapsed state is
 * `0fr 1fr` — mixing a length in kills the animation outright.
 *
 * 1.1fr/1fr over 1676 (1700 less the gap) gives ≈878 guide / ≈798 chat. The
 * guide deliberately stops just under 900: past that the measure gets too long
 * to read comfortably, which is why the extra width went to the chat and why
 * this ratio should not be pushed further in the guide's favour.
 */
const SPLIT_MAX_W = 1700;
const SPLIT_COLS = "1.1fr 1fr";

/**
 * ⚠️ HEIGHT OF THE SPLIT ROW WHEN FRAMED — tune THIS LINE from real observation.
 *
 * A fixed number, NOT derived from 100vh, and the reason is measured rather than
 * assumed. The ?hdDebug=1 probe in the real GHL desktop frame reported
 * innerH = 995 against screen = 982: the frame is handed almost the whole window
 * height, while the actually visible strip is that minus the browser toolbar,
 * GHL's own top bar and whatever banner is running — roughly 230px, and it
 * varies per person and per day. `100vh` in here does not measure the visible
 * area; using it reads like a calculation but is a guess. A conservative
 * constant is at least an honest guess, and it is the same treatment as
 * IFRAME_BAR_BOTTOM_OFFSET in pages/events/EventsPage.tsx.
 *
 * Erring low on purpose: dead space below the panes is something the owner can
 * see and report, whereas a composer pushed under the fold is a control that
 * cannot be used at all.
 *
 * Too much empty space under the panes → raise it. Composer clipped → lower it.
 */
const FRAMED_SPLIT_H_PX = 560;

/** Everything above the split row: fixed navbar, page top padding, header block,
 *  tab bar and their margins. Only used unframed, where 100vh is trustworthy. */
const SPLIT_CHROME_PX = 300;
/** Floor for the row. Below this the chat stops being usable at all. */
const SPLIT_MIN_H_PX = 420;

/**
 * Height of the split row.
 *
 * Framed, `100vh` appears only as an UPPER clamp, never as the value: it cannot
 * shrink the row below what is comfortable, but if the frame itself is genuinely
 * short it stops us from reserving more height than the frame even has. The
 * overestimate is harmless in that role — 995 yields 695, which the 560 cap
 * swallows — while a genuinely short frame still gets a proportionate row down
 * to the floor.
 */
const splitHeight = (framed: boolean) =>
  framed
    ? `clamp(${SPLIT_MIN_H_PX}px, calc(100vh - ${SPLIT_CHROME_PX}px), ${FRAMED_SPLIT_H_PX}px)`
    : `max(${SPLIT_MIN_H_PX}px, calc(100vh - ${SPLIT_CHROME_PX}px))`;

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
  /**
   * The left pane is open. Tracked separately from articleId because the pane
   * has TWO contents: a guide, and — after backing out of one — the guide list,
   * so the reader can pick the next one without leaving the split and coming
   * back in.
   */
  const [splitOpen, setSplitOpen] = useState(false);
  /** Which tab the split was entered FROM. Decides where "back" leads. */
  const [originTab, setOriginTab] = useState<Tab>("chat");
  const framed = useRef(inIframe()).current;
  const articleScrollRef = useRef<HTMLDivElement>(null);

  /** The left pane is showing something → on desktop it sits BESIDE the chat. */
  const split = splitOpen;

  // From an AI answer's source link this no longer navigates away from the
  // conversation: the guide opens in the left pane and the chat stays on the right.
  function openArticle(id: string) {
    // First open only — following a link from inside an open guide must not
    // overwrite where the reader originally came from.
    if (!splitOpen) setOriginTab(tab);
    setSplitOpen(true);
    setArticleId(id);
  }

  /**
   * Back out of a guide.
   *
   * ONE rule, two outcomes: back undoes the last step of the path the reader
   * actually took.
   *
   * Came from the guide list → the step before this guide was the list, so the
   * pane returns to it and the split stays up. Reading several guides in a row
   * is the normal way to use this, and it should not require leaving and
   * re-entering.
   *
   * Came from a citation in an answer → the step before was the conversation.
   * That reader never chose to browse; dropping them on a list they never asked
   * for is a non-sequitur, and their actual task is the question they were in
   * the middle of. So the split closes and returns them to it.
   */
  function backFromArticle() {
    if (originTab !== "browse") {
      closeSplit();
      return;
    }
    setArticleId(null);
  }

  /** Leave the split entirely, back to the tab it was entered from. */
  function closeSplit() {
    setSplitOpen(false);
    setArticleId(null);
    setTab(originTab);
  }

  // A second guide opened from inside the first must start at ITS top. Assigns
  // scrollTop on the pane rather than calling scrollIntoView, which walks up to
  // the document and would drag the whole page (see the CoursePlayer note in
  // PROGRESS).
  useEffect(() => {
    if (articleScrollRef.current) articleScrollRef.current.scrollTop = 0;
  }, [articleId]);

  // No location_id → the "open from QAI" gate (mirrors RB's no-location state).
  if (!locationId) return <OpenFromQai lang={lang} />;
  // Not switched on for this sub-account (内测中 whitelist / admin toggle).
  if (allowed === false) return <HelpNotEnabled lang={lang} />;

  const businessName = location?.business_name?.trim();

  // The chat pane is on screen whenever a guide is open, whatever tab says.
  const chatVisible = split || tab === "chat";
  // While reading, 浏览教程 is the honest highlight: that is the task, and the
  // chat alongside it is a companion pane rather than the current tab.
  const activeTab: Tab = split ? "browse" : tab;

  const tabs: { key: Tab; label: string; icon: typeof MessageCircle }[] = [
    { key: "chat", label: lang === "cn" ? "AI 问答" : "AI Chat", icon: MessageCircle },
    { key: "browse", label: lang === "cn" ? "浏览教程" : "Guides", icon: BookOpen },
    { key: "updates", label: lang === "cn" ? "更新" : "Updates", icon: Megaphone },
  ];

  return (
    <div className="px-4 sm:px-6 pb-16 pt-24 md:pt-28">
      <ViewportProbe />
      {/* The column widens for the split and narrows back. Both this and the
          track sizes below animate as plain lengths — the only shape CSS will
          actually tween (see the grid comment). */}
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
                // bar always means "what this page is showing"; reading a guide
                // is a state of that, not an escape from it.
                onClick={() => {
                  setSplitOpen(false);
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
          states declare two tracks and differ only in their fr values, which
          interpolate. `display` cannot be transitioned, a track cannot be added
          mid-animation, and `width: auto` is not a length.

          Keeping a 0fr track needs three things, all load-bearing:
            · `min-w-0` — a track otherwise floors at its content's min-content
              width, so "0fr" would really mean "as wide as the longest word".
            · `overflow-hidden` — content must be clipped while the track shrinks.
            · `visibility` — a zero-width pane is still focusable and still read
              aloud; hiding it fixes both, which `aria-hidden` alone would not.
              Delayed by the animation on the way out so the guide does not
              vanish before its pane has closed. Chosen over `inert`, which
              browsers support but React 18 neither types nor forwards.

          🔴 THE FIXED HEIGHT IS APPLIED ONLY WHEN SPLIT. The first attempt
          (reverted in 36ca6f8) put it on the grid unconditionally, and that is
          exactly what broke: of the three things the right pane can hold, only
          HelpChat is built for a fixed-height parent (h-full + min-h-0 + an
          inner overflow-y-auto). HelpBrowse and HelpUpdates are plain flow —
          written for a page that grows — so under a locked 575px box with no
          overflow anywhere they simply painted straight out of it, through the
          footer, which is a normal-flow element sitting right after. Collapsed
          therefore keeps NO height constraint and behaves exactly as it always
          has; only the split state, where both panes are things that do scroll,
          gets one. The fix is this condition, not a scattering of overflow
          rules — those would have hidden the symptom and kept the mistake.

          Below lg nothing splits: display is block, the two children swap by
          class, and a guide replaces the page as it always has.
        */}
        {/*
          `lg:grid-rows-[minmax(0,1fr)]` is NOT decoration — a height on a grid
          container does not constrain its ROWS. The implicit row is `auto`, so it
          sizes to content, the panes' `h-full` resolves against THAT, and the
          whole thing overflows the box it was supposed to fit inside. Measured
          before this line existed: container 600px, content 7066px, both panes
          6466px past the bottom. `minmax(0, 1fr)` pins the row to the container.
          It pairs with `min-h-0` on each pane below: grid items default to
          `min-height: auto`, which refuses to shrink below min-content and would
          burst the row again on its own.
        */}
        <div
          className={`lg:grid lg:gap-6 ${split ? "lg:h-[var(--split-h)] lg:grid-rows-[minmax(0,1fr)]" : ""}`}
          style={{
            gridTemplateColumns: split ? SPLIT_COLS : "0fr 1fr",
            transition: "grid-template-columns 300ms ease-out",
            ["--split-h" as string]: splitHeight(framed),
          }}
        >
          {/* Guide pane */}
          <div
            className={`${split ? "block" : "hidden"} lg:block min-w-0 overflow-hidden ${split ? "lg:h-full lg:min-h-0" : ""}`}
            style={{
              visibility: split ? "visible" : "hidden",
              transition: `visibility 0s linear ${split ? "0ms" : "300ms"}`,
            }}
          >
            {/* The pane's own scroll container. It has to exist for BOTH
                contents: HelpBrowse is plain flow with no internal scrolling, so
                inside a fixed-height pane it is the same shape of mistake that
                broke the first attempt — it just happens to be caught here
                because this wrapper clips it. */}
            <div
              ref={articleScrollRef}
              className={split ? "lg:h-full lg:overflow-y-auto lg:pr-1" : ""}
            >
              {articleId ? (
                <ArticleReader lang={lang} id={articleId} onBack={backFromArticle} />
              ) : (
                split && (
                  <div className="space-y-3">
                    {/* Labelled "close", not "back": HelpBrowse has its own 返回分类
                        for moving up a level, and two identical-looking controls
                        doing different things is worse than one extra word. */}
                    <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={closeSplit}>
                      <X className="w-4 h-4" />
                      {lang === "cn" ? "关闭指南" : "Close guides"}
                    </Button>
                    <HelpBrowse
                      lang={lang}
                      articleId={null}
                      onOpenArticle={openArticle}
                      onBack={closeSplit}
                    />
                  </div>
                )
              )}
            </div>
          </div>

          {/* Chat / browse / updates pane */}
          <div className={`${split ? "hidden lg:block" : "block"} min-w-0 ${split ? "lg:h-full lg:min-h-0" : ""}`}>
            {/* HelpChat is mounted for the page's whole life and only hidden.
                Remounting it on every tab or split change would throw away
                half-typed input and an in-flight request, and visibly re-fetch
                the thread each time. */}
            <div
              className={`${chatVisible ? "block" : "hidden"} ${
                split ? "lg:h-full" : "h-[68vh] min-h-[420px]"
              }`}
            >
              <HelpChat
                lang={lang}
                locationId={locationId}
                staffEmail={staff.email}
                staffName={staff.name}
                onOpenArticle={openArticle}
                visible={chatVisible}
              />
            </div>
            {/* Never rendered while split, so neither ever sits under a fixed
                height — see the note above. */}
            {!split && tab === "browse" && (
              <HelpBrowse
                lang={lang}
                articleId={null}
                onOpenArticle={openArticle}
                onBack={closeSplit}
              />
            )}
            {!split && tab === "updates" && <HelpUpdates lang={lang} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * TEMPORARY — measure the real GHL iframe, then delete this component.
 *
 * A first attempt at the split layout (reverted in 36ca6f8) was verified only
 * against a local dev server in a 1600×900 window, and broke in the GHL frame:
 * the footer cut through the chat with content spilling past it. Two numbers
 * were assumed rather than measured, and both are only knowable from inside the
 * real frame:
 *
 *   · WIDTH — the split hangs entirely off Tailwind's `lg` (≥1024px). GHL's
 *     desktop chrome eats a sidebar on the left and some slack on the right, so
 *     a 1920 screen does NOT mean a 1024+ iframe. Under it, the split can never
 *     appear for a real customer.
 *   · HEIGHT — `100vh` measures the FRAME, which runs taller than the parent's
 *     visible area (same trap as IFRAME_BAR_BOTTOM_OFFSET on the events page).
 *     A fixed-height row shorter than its content spills, and the footer — a
 *     normal-flow element right after it — ends up painted through the middle.
 *
 * Gated on ?hdDebug=1 so no customer ever sees it. Fixed-position and its own
 * stacking context, so it stays readable however the layout beneath misbehaves.
 */
function ViewportProbe() {
  const [on] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("hdDebug") === "1";
    } catch {
      return false;
    }
  });
  const [, force] = useState(0);

  useEffect(() => {
    if (!on) return;
    const onResize = () => force((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [on]);

  if (!on) return null;

  const lgHit = window.matchMedia("(min-width: 1024px)").matches;
  const de = document.documentElement;
  const vv = window.visualViewport;
  const rows: [string, string][] = [
    ["innerW × innerH", `${window.innerWidth} × ${window.innerHeight}`],
    ["clientW × clientH", `${de.clientWidth} × ${de.clientHeight}`],
    ["visualViewport", vv ? `${Math.round(vv.width)} × ${Math.round(vv.height)}` : "—"],
    ["screen", `${window.screen.width} × ${window.screen.height}`],
    ["in iframe", inIframe() ? "YES" : "no"],
    ["lg (>=1024)", lgHit ? "HIT — split possible" : "MISS — split impossible"],
    ["doc scrollH", `${de.scrollHeight}`],
  ];

  return (
    <div
      className="fixed left-2 top-2 z-[9999] rounded-lg border-2 border-[#fed50a] bg-[#141414] px-3 py-2 font-mono text-[11px] leading-relaxed text-white shadow-xl"
      style={{ pointerEvents: "none" }}
    >
      <div className="mb-1 font-bold text-[#fed50a]">HELPDESK VIEWPORT PROBE</div>
      {rows.map(([k, v]) => (
        <div key={k}>
          <span className="text-white/55">{k}:</span> {v}
        </div>
      ))}
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
