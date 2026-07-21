import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown, ChevronRight } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";
import { resolveLocationId } from "@/lib/ghl";
import logo from "@/assets/logo.png";
import QuickLinkPopout from "./QuickLinkPopout";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

// Help/guide links — shown under the navbar "Guides" dropdown; each opens
// its QuickLinkPopout on hover (moved here from the homepage hero).
const guideLinks = [
  { en: "WhatsApp SMS Guideline", cn: "WhatsApp SMS Guideline", href: "https://support.qiai.tech/whatsapp-onboarding", popout: "sms-guideline" as const },
  { en: "WhatsApp vs WABA", cn: "WhatsApp vs WABA", href: "https://support.qiai.tech/whatsapp-waba", popout: "wa-vs-waba" as const },
  { en: "Payex/Senangpay Guideline", cn: "Payex/Senangpay Guideline", href: "https://support.qiai.tech/payex/senangpay", popout: "payex-senangpay" as const },
];

const navLinks = [
  { label: t.nav.home, href: "#hero" },
  // Help Center — between 首页 and DFY. withLocation: carries the GHL
  // location_id (URL or the stashed one) so it doesn't hit the GHL-only block.
  { label: { en: "Help Center", cn: "帮助中心" }, href: "/help", isRoute: true, noSemibold: true, withLocation: true },
  { label: { en: "DFY", cn: "DFY" }, href: "/dfy", isRoute: true, noSemibold: true },
  { label: { en: "Credits", cn: "额度" }, href: "/credits", isRoute: true, noSemibold: true },
  { label: { en: "Upgrade", cn: "升级" }, href: "/upgrade", isRoute: true, noSemibold: true },
  { label: { en: "Affiliate", cn: "伙伴" }, href: "/affiliate", isRoute: true, noSemibold: true },
];

// Product tools — grouped under the navbar "小工具 / Tools" dropdown. withLocationPath
// sends a customer straight to their own view (/review-boost/location/<id>) using
// the stashed GHL location_id. More tools (e.g. the copywriter) join here after
// the branches merge to main (P10).
const toolLinks = [
  { label: { en: "Review Boost", cn: "Review Boost" }, base: "/review-boost", withLocationPath: true },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { lang, toggleLang } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";

  // GHL location_id (URL, else stashed this tab session) — appended to links
  // marked withLocation so navigating in keeps the trust-the-URL identity.
  const locId = resolveLocationId(location.pathname, location.search);
  const routeHref = (link: typeof navLinks[number]) =>
    link.withLocation && locId ? `${link.href}?location_id=${encodeURIComponent(locId)}` : link.href;
  const toolHref = (tool: typeof toolLinks[number]) =>
    tool.withLocationPath && locId ? `${tool.base}/location/${encodeURIComponent(locId)}` : tool.base;

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, link: typeof navLinks[0]) => {
    if (link.isRoute) return; // normal navigation for route links
    if (!isHome) {
      e.preventDefault();
      navigate("/" + link.href);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-nav">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center">
          <img src={logo} alt="ONI" className="h-8" />
        </a>

        {/* Desktop nav */}
        <nav id="navbar-nav" className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            link.isRoute ? (
              <a
                key={link.label.en}
                id={`nav-${link.href.replace("/", "")}`}
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
            )
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {/* Tools dropdown — groups the product tools (Review Boost now; more at P10). */}
          <HoverCard openDelay={80} closeDelay={150}>
            <HoverCardTrigger asChild>
              <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 px-1">
                {lang === "cn" ? "小工具" : "Tools"}
                <ChevronDown size={14} />
              </button>
            </HoverCardTrigger>
            <HoverCardContent align="end" sideOffset={12} className="w-52 p-2">
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
              </div>
            </HoverCardContent>
          </HoverCard>

          {/* Guides dropdown — groups the help links; each opens its popout on hover */}
          <HoverCard openDelay={80} closeDelay={150}>
            <HoverCardTrigger asChild>
              <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 px-1">
                {lang === "cn" ? "指南" : "Guides"}
                <ChevronDown size={14} />
              </button>
            </HoverCardTrigger>
            <HoverCardContent align="end" sideOffset={12} className="w-60 p-2">
              <div className="flex flex-col">
                {guideLinks.map((link) => (
                  <HoverCard key={link.en} openDelay={80} closeDelay={150}>
                    <HoverCardTrigger asChild>
                      <a
                        href={link.href}
                        onClick={(e) => e.preventDefault()}
                        className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent/10 cursor-pointer transition-colors"
                      >
                        <span>{lang === "cn" ? link.cn : link.en}</span>
                        <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                      </a>
                    </HoverCardTrigger>
                    <HoverCardContent side="left" align="start" sideOffset={12} className="w-auto p-0 border-0 bg-transparent shadow-none">
                      <QuickLinkPopout type={link.popout} lang={lang} />
                    </HoverCardContent>
                  </HoverCard>
                ))}
              </div>
            </HoverCardContent>
          </HoverCard>
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
          className="md:hidden p-2"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-background border-t border-border px-6 py-6 space-y-4">
          {navLinks.map((link) => (
            <a
              key={link.label.en}
              href={link.isRoute ? routeHref(link) : (isHome ? link.href : "/" + link.href)}
              className={`block text-sm transition-colors ${link.isRoute ? "text-foreground hover:text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={(e) => { handleNavClick(e, link); setMobileOpen(false); }}
            >
              {link.label[lang]}
            </a>
          ))}

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
          </div>

          {/* Guides group */}
          <div className="pt-3 border-t border-border">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              {lang === "cn" ? "指南" : "Guides"}
            </p>
            {guideLinks.map((link) => (
              <a
                key={link.en}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-muted-foreground hover:text-foreground py-1.5 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {lang === "cn" ? link.cn : link.en}
              </a>
            ))}
          </div>

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
