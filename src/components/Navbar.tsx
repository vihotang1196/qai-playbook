import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Pin,
  Home,
  LifeBuoy,
  CalendarDays,
  Wrench,
  Coins,
  CircleArrowUp,
  Handshake,
  Boxes,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";
import { resolveLocationId, setDefaultPage, getDefaultPage } from "@/lib/ghl";
import logo from "@/assets/logo.png";
import { GUIDES } from "@/pages/guides/guides";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Brutalist skin for the nav tooltips. The shared shadcn TooltipContent is still
// on its stock look (1px border, soft shadow), and it has no other consumer, so
// the override lives here rather than in the shared component — changing that
// file would restyle anything added later without review.
const TOOLTIP_BRUTALIST =
  "border-2 border-[#141414] bg-white text-[#141414] rounded-xl shadow-[4px_4px_0_#141414] px-3 py-1.5 text-sm font-semibold";

// Help/guide links — shown under the navbar "Guides" dropdown. Each entry clicks
// straight through to its full page at /guides/:slug (the single source of truth
// is the GUIDES registry in src/pages/guides/guides.tsx). Replaces the old dead
// hover-popouts, whose content had already been moved to the full pages.

// ════════════════════════════════════════════════════════════════════════
// NAV OWNERSHIP — which URLs light up which navbar item.
//
// ⚠️  ADDING A PAGE? REGISTER ITS PATH HERE.  An unlisted route lights up
//     nothing, and the navbar quietly stops telling the customer where they
//     are. Nothing errors, nothing logs — it just goes blank, which is the
//     kind of bug nobody reports.
//
// MATCHING RULES (see pathMatches below):
//   '/'  → EXACT. Every path starts with '/', so a prefix match would keep
//          首页 lit on every page forever.
//   else → the path itself, or any child of it. That is what lets
//          '/review-boost' cover its 8 sub-routes with one entry.
//
// WHY AN EXPLICIT TABLE INSTEAD OF `pathname.startsWith(link.href)`:
// the Stripe return page is '/checkout/return' — a TOP-LEVEL route, NOT a
// child of '/events' (see App.tsx). Deriving ownership from each item's own
// href would blank the whole navbar on the page a customer lands on straight
// after paying, which is exactly when they most want to see they are still
// inside the booking flow. Ownership is a decision, so it is written down.
// ════════════════════════════════════════════════════════════════════════

/** Tools dropdown — every customer-facing tool page wears the navbar (they all
 *  live inside <Layout>). '/tools' is the hub page: it has no navbar entry of
 *  its own (see the commented-out line below), but it belongs to this group. */
const OWNS_TOOLS = ["/copywriter", "/review-boost", "/tools"];

/** Guides dropdown — derived from the GUIDES registry rather than hardcoded,
 *  so a new guide is covered the moment it is registered there. */
const OWNS_GUIDES = GUIDES.map((g) => `/guides/${g.slug}`);

/** One owned path vs the current pathname. '/' is exact; everything else
 *  matches itself or a child, never a same-prefixed sibling ('/help' must not
 *  claim a future '/helpdesk'). */
const pathMatches = (owned: string, pathname: string) =>
  owned === "/" ? pathname === "/" : pathname === owned || pathname.startsWith(`${owned}/`);

const ownsCurrent = (owns: string[] | undefined, pathname: string) =>
  !!owns?.some((p) => pathMatches(p, pathname));

/** Scheme B current-page marker: a hard yellow bar under the icon. Not a
 *  filled chip — every item here is an equal link, and only one of them
 *  wearing a border + fill reads as "this one is a button, the rest aren't".
 *  Being underneath also keeps it out of the flex flow, so switching pages
 *  never nudges the row sideways. */
const ActiveBar = () => (
  <span aria-hidden="true" className="pointer-events-none absolute inset-x-1 -bottom-3 h-1 bg-[#fed50a]" />
);

/** Mobile current-page marker: a 3px yellow rule down the left edge plus bold.
 *  The mobile menu keeps its text, but 12 rows in one column is exactly where
 *  you lose track of where you are, and touch has no hover to fall back on.
 *  Not a filled row — Brutalist keeps yellow for accents, and a whole yellow
 *  row is far more weight than "you are here" deserves. Idle rows carry the
 *  same transparent border so switching pages never shifts the text sideways.
 *  `idle` is applied ONLY when inactive: passing both sets of colour classes
 *  would leave the winner to stylesheet order rather than to intent. */
const mobileRow = (active: boolean, idle: string) =>
  `block border-l-[3px] pl-3 text-sm transition-colors ${
    active ? "border-[#fed50a] font-semibold text-foreground" : `border-transparent ${idle}`
  }`;

type NavItem = {
  label: { en: string; cn: string };
  href?: string;
  external?: string;
  isRoute?: boolean;
  noSemibold?: boolean;
  withLocation?: boolean; // append ?location_id= so the tool recognises the sub-account
  /** DESKTOP ONLY. When set, the desktop bar shows this icon instead of the
   *  label, with the label in a tooltip and on aria-label. The mobile menu
   *  always stays text: touch has no hover, so an icon there would be a riddle. */
  icon?: LucideIcon;
  /** Which URLs count as "you are here". See the NAV OWNERSHIP block above —
   *  this is NOT derived from `href`, and a page missing from it lights nothing. */
  owns?: string[];
};

const navLinks: NavItem[] = [
  { label: t.nav.home, href: "#hero", icon: Home, owns: ["/"] },
  // Help Center — the internal Helpdesk page (/help). withLocation carries the GHL
  // location_id so the shared help center recognises the sub-account.
  { label: { en: "Help Center", cn: "帮助中心" }, href: "/help", isRoute: true, noSemibold: true, withLocation: true, icon: LifeBuoy, owns: ["/help"] },
  // Offline Event — promoted from the 小工具 dropdown to the main menu (owner ask).
  // withLocation carries the GHL location_id so the tool recognises the sub-account.
  { label: { en: "Offline Event", cn: "线下活动报名" }, href: "/events", isRoute: true, noSemibold: true, withLocation: true, icon: CalendarDays, owns: ["/events", "/checkout/return"] },
  // Wrench for DFY (Done For You) — "someone is doing the work for you". It does
  // not collide with the 小工具 dropdown, which keeps its text label.
  { label: { en: "DFY", cn: "DFY" }, href: "/dfy", isRoute: true, noSemibold: true, icon: Wrench, owns: ["/dfy"] },
  // Coins, not Wallet: a wallet reads as "pay something", coins read as "balance
  // of points", which is what this page actually shows.
  { label: { en: "Credits", cn: "额度" }, href: "/credits", isRoute: true, noSemibold: true, icon: Coins, owns: ["/credits"] },
  // Circled arrow, not a bare one: a naked up-arrow reads as "back to top".
  { label: { en: "Upgrade", cn: "升级" }, href: "/upgrade", isRoute: true, noSemibold: true, icon: CircleArrowUp, owns: ["/upgrade"] },
  { label: { en: "Affiliate", cn: "伙伴" }, href: "/affiliate", isRoute: true, noSemibold: true, icon: Handshake, owns: ["/affiliate"] },
  // Tools / 小工具 — deliberately NOT a top-level nav item, and this is not the
  // old "hide the copywriter" reason (that one is dead: it has an identity gate
  // and rate limits now, and Copy Generator is a live link in the dropdown below).
  //
  // It stays out because the navbar ALREADY shows a 「小工具」 — the dropdown
  // trigger below (a button, not a link). Enabling this line puts a second entry
  // with the identical label right next to it, one going to the /tools hub page
  // and one opening the dropdown. Verified 2026-07-29, desktop and mobile.
  //
  // The hub page loses nothing worth having: every tool on it is now a direct
  // link in the dropdown. If /tools is ever wanted in the navbar, rename one of
  // the two first.
  // { label: { en: "Tools", cn: "小工具" }, href: "/tools", isRoute: true, noSemibold: true, withLocation: true },
];

type ToolItem = {
  label: { en: string; cn: string };
  href?: string; // withLocation → append ?location_id=
  base?: string; // withLocationPath → /base/location/<id>
  withLocation?: boolean;
  withLocationPath?: boolean;
};

// Product tools grouped under the "小工具 / Tools" dropdown. Only tools that
// actually exist on THIS branch are real links (they carry the GHL location_id);
// anything still listed as Coming-Soon has NO link, so nothing dead is publicly
// clickable. (Offline Event was promoted to the main menu, so it's no longer
// listed here — one entry only, no duplicate.)
//
// Copy Generator moved from Coming-Soon to a real link on 2026-07-29: it has an
// identity gate and per-sub-account rate limits now, which were the two things
// its placeholder was waiting on.
const toolLinks: ToolItem[] = [
  { label: { en: "Review Boost", cn: "Review Boost" }, base: "/review-boost", withLocationPath: true },
  { label: { en: "Copy Generator", cn: "文案生成器" }, href: "/copywriter", withLocation: true },
];
const comingSoonTools: { label: { en: string; cn: string } }[] = [
  { label: { en: "WhatsApp Copy", cn: "WhatsApp 文案" } },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { lang, toggleLang } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";

  // GHL location_id (URL, else stashed this tab session) — appended to the tool
  // links so navigating in keeps the trust-the-URL identity.
  const locId = resolveLocationId(location.pathname, location.search);
  const toolHref = (tool: ToolItem) => {
    if (tool.withLocationPath && locId) return `${tool.base}/location/${encodeURIComponent(locId)}`;
    if (tool.withLocation && locId) return `${tool.href}?location_id=${encodeURIComponent(locId)}`;
    return tool.href ?? tool.base ?? "#";
  };
  // Route nav links: append the location_id for withLocation links (e.g. Help
  // Center /help) so the tool recognises the sub-account; others unchanged.
  const routeHref = (link: NavItem) =>
    link.withLocation && locId && link.href ? `${link.href}?location_id=${encodeURIComponent(locId)}` : (link.href ?? "#");

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, link: NavItem) => {
    if (link.isRoute) return; // normal navigation for route links
    if (!isHome) {
      e.preventDefault();
      navigate("/" + link.href);
    }
  };

  // Need 1 — the sub-account's default landing page (stored per location_id
  // server-side). `null` = none set, so the Playbook opens its own fallback.
  // Loaded so the control can SHOW the current choice: setting a default you
  // can neither see nor undo is what made this feel broken.
  const [defaultPath, setDefaultPathState] = useState<string | null>(null);
  useEffect(() => {
    if (!locId) return;
    getDefaultPage(locId).then(setDefaultPathState).catch(() => {
      /* control still works; it just can't show the current value */
    });
  }, [locId]);

  /** Friendly name for a stored path, falling back to the path itself. */
  const pageLabel = (path: string) => {
    const hit = navLinks.find((l) => l.isRoute && l.href === path);
    if (hit) return hit.label[lang];
    if (path === "/") return lang === "cn" ? "首页" : "Home";
    return path;
  };

  const setAsDefault = async () => {
    if (!locId) return;
    try {
      await setDefaultPage(locId, location.pathname);
      setDefaultPathState(location.pathname);
      toast.success(lang === "cn" ? "已设为默认打开页" : "Set as your default page");
    } catch {
      toast.error(lang === "cn" ? "设置失败，请重试" : "Couldn't save, try again");
    }
  };

  const clearDefault = async () => {
    if (!locId) return;
    try {
      await setDefaultPage(locId, ""); // "" → the server deletes the override
      setDefaultPathState(null);
      toast.success(lang === "cn" ? "已清除默认页" : "Default page cleared");
    } catch {
      toast.error(lang === "cn" ? "清除失败，请重试" : "Couldn't clear, try again");
    }
  };

  const isCurrentDefault = !!defaultPath && defaultPath === location.pathname;

  const here = location.pathname;

  /** Desktop link body: the icon when the item has one, else the label, plus
   *  the current-page bar. */
  const navBody = (link: NavItem) => {
    const Icon = link.icon;
    return (
      <>
        {/* aria-hidden on the glyph: the accessible name comes from the anchor's
            aria-label, so the icon must not announce itself a second time. */}
        {Icon ? <Icon size={16} aria-hidden="true" /> : link.label[lang]}
        {ownsCurrent(link.owns, here) && <ActiveBar />}
      </>
    );
  };

  /** Icon-only links get the label back as a tooltip. Radix opens it on focus
   *  as well as hover, which is what keeps the bar usable from the keyboard. */
  const withTooltip = (link: NavItem, node: React.ReactNode) =>
    link.icon ? (
      <Tooltip key={link.label.en}>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent sideOffset={10} className={TOOLTIP_BRUTALIST}>
          {link.label[lang]}
        </TooltipContent>
      </Tooltip>
    ) : (
      node
    );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-nav">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center">
          <img src={logo} alt="ONI" className="h-8" />
        </a>

        {/* Desktop nav */}
        {/* Desktop nav — icon-only (labels move into tooltips); gap tightened
            from 8 to 6 because 16px glyphs at the old spacing read as unrelated
            buttons rather than one bar. The two dropdowns keep their text. */}
        <nav id="navbar-nav" className="hidden lg:flex items-center gap-6">
          {navLinks.map((link) =>
            link.external ? (
              withTooltip(
                link,
                <a
                  key={link.label.en}
                  href={link.external}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={link.icon ? link.label[lang] : undefined}
                  aria-current={ownsCurrent(link.owns, here) ? "page" : undefined}
                  className={`text-sm text-foreground hover:text-accent-foreground transition-colors duration-300 relative ${link.icon ? "p-1.5" : ""} ${link.noSemibold ? "" : "font-semibold"}`}
                >
                  {navBody(link)}
                </a>,
              )
            ) : link.isRoute ? (
              withTooltip(
                link,
                <a
                  key={link.label.en}
                  id={`nav-${link.href?.replace("/", "")}`}
                  href={routeHref(link)}
                  aria-label={link.icon ? link.label[lang] : undefined}
                  aria-current={ownsCurrent(link.owns, here) ? "page" : undefined}
                  className={`text-sm text-foreground hover:text-accent-foreground transition-colors duration-300 relative ${link.icon ? "p-1.5" : ""} ${link.noSemibold ? "" : "font-semibold"}`}
                >
                  {navBody(link)}
                </a>,
              )
            ) : (
              withTooltip(
                link,
                <a
                  key={link.label.en}
                  href={isHome ? link.href : "/" + link.href}
                  onClick={(e) => handleNavClick(e, link)}
                  aria-label={link.icon ? link.label[lang] : undefined}
                  aria-current={ownsCurrent(link.owns, here) ? "page" : undefined}
                  // Iconified anchor-links take the ink colour of the route
                  // links: this branch was muted as a text link, but among six
                  // ink glyphs a lone grey one reads as disabled, not secondary.
                  className={`text-sm transition-colors duration-300 relative ${link.icon ? "p-1.5 text-foreground hover:text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {navBody(link)}
                </a>,
              )
            ),
          )}
          {/* Tools dropdown — in the nav row, right after 伙伴; only tools live on this branch link out */}
          <HoverCard openDelay={80} closeDelay={150}>
            <HoverCardTrigger asChild>
              {/* Icon trigger with NO tooltip — not because one would clash with
                  the hover-opened panel, but because it would be worse than the
                  panel: hovering already lists Review Boost / 文案生成器, which
                  says far more than a chip reading 「小工具」. Keyboard and screen
                  readers get the name from aria-label. */}
              <button
                aria-label={lang === "cn" ? "小工具" : "Tools"}
                className="relative flex items-center gap-1 text-sm text-foreground hover:text-accent-foreground transition-colors duration-300 p-1.5"
              >
                <Boxes size={16} aria-hidden="true" />
                <ChevronDown size={14} aria-hidden="true" />
                {ownsCurrent(OWNS_TOOLS, here) && <ActiveBar />}
              </button>
            </HoverCardTrigger>
            <HoverCardContent align="end" sideOffset={12} className="w-56 p-2">
              <div className="flex flex-col">
                {toolLinks.map((tool) => (
                  <a
                    key={tool.label.en}
                    href={toolHref(tool)}
                    className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent/10 cursor-pointer transition-colors"
                  >
                    <span>{tool.label[lang]}</span>
                    <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                  </a>
                ))}
                {comingSoonTools.map((tool) => (
                  <div
                    key={tool.label.en}
                    className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground/60 cursor-not-allowed"
                  >
                    <span>{tool.label[lang]}</span>
                    <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5">{lang === "cn" ? "即将上线" : "Soon"}</span>
                  </div>
                ))}
              </div>
            </HoverCardContent>
          </HoverCard>

          {/* Guides dropdown — groups the help guides; each clicks through to its
              full page at /guides/:slug (content renders on the page, coral-glass card) */}
          <HoverCard openDelay={80} closeDelay={150}>
            <HoverCardTrigger asChild>
              <button
                aria-label={lang === "cn" ? "指南" : "Guides"}
                className="relative flex items-center gap-1 text-sm text-foreground hover:text-accent-foreground transition-colors duration-300 p-1.5"
              >
                <BookOpen size={16} aria-hidden="true" />
                <ChevronDown size={14} aria-hidden="true" />
                {ownsCurrent(OWNS_GUIDES, here) && <ActiveBar />}
              </button>
            </HoverCardTrigger>
            <HoverCardContent align="end" sideOffset={12} className="w-60 p-2">
              <div className="flex flex-col">
                {GUIDES.map((g) => (
                  <a
                    key={g.slug}
                    href={`/guides/${g.slug}`}
                    className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent/10 cursor-pointer transition-colors"
                  >
                    <span>{g.title[lang]}</span>
                    <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                  </a>
                ))}
              </div>
            </HoverCardContent>
          </HoverCard>
        </nav>

        <div className="hidden lg:flex items-center gap-2">
          {locId && (
            <HoverCard openDelay={80} closeDelay={120}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  className={`flex items-center gap-1 text-sm transition-colors duration-300 px-1 ${
                    defaultPath ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Pin size={14} className={defaultPath ? "fill-current" : ""} />
                  {lang === "cn" ? "默认页" : "Default"}
                </button>
              </HoverCardTrigger>
              <HoverCardContent align="end" className="w-64 p-3">
                <p className="text-xs text-muted-foreground">
                  {lang === "cn" ? "现在的默认打开页" : "Current default page"}
                </p>
                <p className="text-sm font-medium mt-0.5">
                  {defaultPath
                    ? pageLabel(defaultPath)
                    : lang === "cn"
                      ? "未设置（打开帮助中心）"
                      : "Not set (opens Help Center)"}
                </p>
                <div className="mt-2.5 space-y-1.5">
                  <button
                    type="button"
                    onClick={setAsDefault}
                    disabled={isCurrentDefault}
                    className="w-full text-left text-sm rounded-lg px-2 py-1.5 hover:bg-accent/10 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    {isCurrentDefault
                      ? lang === "cn" ? "当前页已是默认" : "This page is already the default"
                      : lang === "cn" ? "把当前页设为默认" : "Make this page the default"}
                  </button>
                  {defaultPath && (
                    <button
                      type="button"
                      onClick={clearDefault}
                      className="w-full text-left text-sm rounded-lg px-2 py-1.5 hover:bg-accent/10"
                    >
                      {lang === "cn" ? "清除默认页" : "Clear default"}
                    </button>
                  )}
                </div>
              </HoverCardContent>
            </HoverCard>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLang}
            className="text-xs font-semibold tracking-wide ml-1"
          >
            {lang === "cn" ? "EN" : "中文"}
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden p-2"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-background border-t border-border px-6 py-6 space-y-4">
          {navLinks.map((link) =>
            link.external ? (
              <a
                key={link.label.en}
                href={link.external}
                target="_blank"
                rel="noreferrer"
                className={mobileRow(false, "text-foreground hover:text-accent-foreground")}
                onClick={() => setMobileOpen(false)}
              >
                {link.label[lang]}
              </a>
            ) : (
              <a
                key={link.label.en}
                href={link.isRoute ? routeHref(link) : (isHome ? link.href : "/" + link.href)}
                aria-current={ownsCurrent(link.owns, here) ? "page" : undefined}
                className={mobileRow(
                  ownsCurrent(link.owns, here),
                  link.isRoute ? "text-foreground hover:text-accent-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                onClick={(e) => { handleNavClick(e, link); setMobileOpen(false); }}
              >
                {link.label[lang]}
              </a>
            ),
          )}

          {/* Tools group */}
          <div className="pt-3 border-t border-border">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              {lang === "cn" ? "小工具" : "Tools"}
            </p>
            {toolLinks.map((tool) => {
              // Highlight the tool ITSELF, not the group: in the mobile menu the
              // group is already expanded, so marking the row the customer is on
              // is the useful signal.
              const toolPath = tool.base ?? tool.href;
              const active = !!toolPath && pathMatches(toolPath, here);
              return (
                <a
                  key={tool.label.en}
                  href={toolHref(tool)}
                  aria-current={active ? "page" : undefined}
                  className={`${mobileRow(active, "text-muted-foreground hover:text-foreground")} py-1.5`}
                  onClick={() => setMobileOpen(false)}
                >
                  {tool.label[lang]}
                </a>
              );
            })}
            {comingSoonTools.map((tool) => (
              <div key={tool.label.en} className="flex items-center gap-2 text-sm text-muted-foreground/60 py-1.5">
                {tool.label[lang]}
                <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5">{lang === "cn" ? "即将上线" : "Soon"}</span>
              </div>
            ))}
          </div>

          {/* Guides group */}
          <div className="pt-3 border-t border-border">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              {lang === "cn" ? "指南" : "Guides"}
            </p>
            {GUIDES.map((g) => {
              const active = pathMatches(`/guides/${g.slug}`, here);
              return (
                <a
                  key={g.slug}
                  href={`/guides/${g.slug}`}
                  aria-current={active ? "page" : undefined}
                  className={`${mobileRow(active, "text-muted-foreground hover:text-foreground")} py-1.5`}
                  onClick={() => setMobileOpen(false)}
                >
                  {g.title[lang]}
                </a>
              );
            })}
          </div>

          {locId && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                {lang === "cn" ? "现在的默认打开页：" : "Current default page: "}
                <span className="text-foreground font-medium">
                  {defaultPath
                    ? pageLabel(defaultPath)
                    : lang === "cn" ? "未设置（打开帮助中心）" : "Not set (Help Center)"}
                </span>
              </p>
              <button
                type="button"
                onClick={() => { setAsDefault(); setMobileOpen(false); }}
                disabled={isCurrentDefault}
                className="flex items-center gap-1.5 text-sm text-foreground hover:text-accent-foreground py-1.5 transition-colors disabled:opacity-40"
              >
                <Pin size={14} />
                {isCurrentDefault
                  ? lang === "cn" ? "当前页已是默认" : "This page is already the default"
                  : lang === "cn" ? "把当前页设为默认打开页" : "Set this page as default"}
              </button>
              {defaultPath && (
                <button
                  type="button"
                  onClick={() => { clearDefault(); setMobileOpen(false); }}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground py-1.5 transition-colors"
                >
                  <X size={14} />
                  {lang === "cn" ? "清除默认页" : "Clear default"}
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-semibold ml-auto"
              onClick={toggleLang}
            >
              {lang === "cn" ? "EN" : "中文"}
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
