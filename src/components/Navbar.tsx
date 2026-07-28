import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown, ChevronRight, Pin } from "lucide-react";
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

// Help/guide links — shown under the navbar "Guides" dropdown. Each entry clicks
// straight through to its full page at /guides/:slug (the single source of truth
// is the GUIDES registry in src/pages/guides/guides.tsx). Replaces the old dead
// hover-popouts, whose content had already been moved to the full pages.

type NavItem = {
  label: { en: string; cn: string };
  href?: string;
  external?: string;
  isRoute?: boolean;
  noSemibold?: boolean;
  withLocation?: boolean; // append ?location_id= so the tool recognises the sub-account
};

const navLinks: NavItem[] = [
  { label: t.nav.home, href: "#hero" },
  // Help Center — the internal Helpdesk page (/help). withLocation carries the GHL
  // location_id so the shared help center recognises the sub-account.
  { label: { en: "Help Center", cn: "帮助中心" }, href: "/help", isRoute: true, noSemibold: true, withLocation: true },
  // Offline Event — promoted from the 小工具 dropdown to the main menu (owner ask).
  // withLocation carries the GHL location_id so the tool recognises the sub-account.
  { label: { en: "Offline Event", cn: "线下活动报名" }, href: "/events", isRoute: true, noSemibold: true, withLocation: true },
  { label: { en: "DFY", cn: "DFY" }, href: "/dfy", isRoute: true, noSemibold: true },
  { label: { en: "Credits", cn: "额度" }, href: "/credits", isRoute: true, noSemibold: true },
  { label: { en: "Upgrade", cn: "升级" }, href: "/upgrade", isRoute: true, noSemibold: true },
  { label: { en: "Affiliate", cn: "伙伴" }, href: "/affiliate", isRoute: true, noSemibold: true },
  // Tools / 小工具 — entry HIDDEN from the navbar for now so the copywriter
  // isn't publicly discoverable/abusable (it burns Claude/MiniMax credits)
  // before GHL usage limits exist. The /tools + /copywriter routes stay live
  // and reachable by direct URL. Re-enable this line to show the entry again.
  // { label: { en: "Tools", cn: "小工具" }, href: "/tools", isRoute: true, noSemibold: true },
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
// copywriter / WhatsApp are Coming-Soon placeholders (NO link) until the branches
// merge to main so nothing dead is publicly clickable. (Offline Event was promoted
// to the main menu, so it's no longer listed here — one entry only, no duplicate.)
const toolLinks: ToolItem[] = [
  { label: { en: "Review Boost", cn: "Review Boost" }, base: "/review-boost", withLocationPath: true },
];
const comingSoonTools: { label: { en: string; cn: string } }[] = [
  { label: { en: "Copy Generator", cn: "文案生成器" } },
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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-nav">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center">
          <img src={logo} alt="ONI" className="h-8" />
        </a>

        {/* Desktop nav */}
        <nav id="navbar-nav" className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) =>
            link.external ? (
              <a
                key={link.label.en}
                href={link.external}
                target="_blank"
                rel="noreferrer"
                className={`text-sm text-foreground hover:text-accent-foreground transition-colors duration-300 ${link.noSemibold ? "" : "font-semibold"}`}
              >
                {link.label[lang]}
              </a>
            ) : link.isRoute ? (
              <a
                key={link.label.en}
                id={`nav-${link.href?.replace("/", "")}`}
                href={routeHref(link)}
                className={`text-sm text-foreground hover:text-accent-foreground transition-colors duration-300 ${link.noSemibold ? "" : "font-semibold"}`}
              >
                {link.label[lang]}
              </a>
            ) : (
              <a
                key={link.label.en}
                href={isHome ? link.href : "/" + link.href}
                onClick={(e) => handleNavClick(e, link)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
              >
                {link.label[lang]}
              </a>
            ),
          )}
          {/* Tools dropdown — in the nav row, right after 伙伴; only tools live on this branch link out */}
          <HoverCard openDelay={80} closeDelay={150}>
            <HoverCardTrigger asChild>
              <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 px-1">
                {lang === "cn" ? "小工具" : "Tools"}
                <ChevronDown size={14} />
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
              <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 px-1">
                {lang === "cn" ? "指南" : "Guides"}
                <ChevronDown size={14} />
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
                className="block text-sm text-foreground hover:text-accent-foreground transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label[lang]}
              </a>
            ) : (
              <a
                key={link.label.en}
                href={link.isRoute ? routeHref(link) : (isHome ? link.href : "/" + link.href)}
                className={`block text-sm transition-colors ${link.isRoute ? "text-foreground hover:text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
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
            {toolLinks.map((tool) => (
              <a
                key={tool.label.en}
                href={toolHref(tool)}
                className="block text-sm text-muted-foreground hover:text-foreground py-1.5 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {tool.label[lang]}
              </a>
            ))}
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
            {GUIDES.map((g) => (
              <a
                key={g.slug}
                href={`/guides/${g.slug}`}
                className="block text-sm text-muted-foreground hover:text-foreground py-1.5 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {g.title[lang]}
              </a>
            ))}
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
