import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown, ChevronRight, Pin } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";
import { resolveLocationId, setDefaultPage } from "@/lib/ghl";
import logo from "@/assets/logo.png";
import QuickLinkPopout from "./QuickLinkPopout";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

// Help/guide links — shown under the navbar "Guides" dropdown; each opens
// its QuickLinkPopout on hover (moved here from the homepage hero). UNCHANGED.
const guideLinks = [
  { en: "WhatsApp SMS Guideline", cn: "WhatsApp SMS Guideline", href: "https://support.qiai.tech/whatsapp-onboarding", popout: "sms-guideline" as const },
  { en: "WhatsApp vs WABA", cn: "WhatsApp vs WABA", href: "https://support.qiai.tech/whatsapp-waba", popout: "wa-vs-waba" as const },
  { en: "Payex/Senangpay Guideline", cn: "Payex/Senangpay Guideline", href: "https://support.qiai.tech/payex/senangpay", popout: "payex-senangpay" as const },
];

type NavItem = {
  label: { en: string; cn: string };
  href?: string;
  external?: string;
  isRoute?: boolean;
  noSemibold?: boolean;
};

const navLinks: NavItem[] = [
  { label: t.nav.home, href: "#hero" },
  // Help Center — external for now (support.qiai.tech). When Helpdesk merges to
  // main it becomes the internal /help page; until then this branch has no /help.
  { label: { en: "Help Center", cn: "帮助中心" }, external: "https://support.qiai.tech", noSemibold: true },
  { label: { en: "DFY", cn: "DFY" }, href: "/dfy", isRoute: true, noSemibold: true },
  { label: { en: "Credits", cn: "额度" }, href: "/credits", isRoute: true, noSemibold: true },
  { label: { en: "Upgrade", cn: "升级" }, href: "/upgrade", isRoute: true, noSemibold: true },
  { label: { en: "Affiliate", cn: "伙伴" }, href: "/affiliate", isRoute: true, noSemibold: true },
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
// merge to main so nothing dead is publicly clickable.
const toolLinks: ToolItem[] = [
  { label: { en: "Offline Event", cn: "线下活动报名" }, href: "/events", withLocation: true },
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

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, link: NavItem) => {
    if (link.isRoute) return; // normal navigation for route links
    if (!isHome) {
      e.preventDefault();
      navigate("/" + link.href);
    }
  };

  // Need 1 — set the CURRENT page as this sub-account's default landing page
  // (stored per location_id server-side). Shown only in a sub-account context.
  const setAsDefault = async () => {
    if (!locId) return;
    try {
      await setDefaultPage(locId, location.pathname);
      toast.success(lang === "cn" ? "已设为默认打开页" : "Set as your default page");
    } catch {
      toast.error(lang === "cn" ? "设置失败，请重试" : "Couldn't save, try again");
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
                href={link.href}
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
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {/* Tools dropdown — the product tools; only ones live on this branch link out */}
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

          {/* Guides dropdown — groups the help links; each opens its popout on hover. UNCHANGED */}
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
          {locId && (
            <button
              type="button"
              onClick={setAsDefault}
              title={lang === "cn" ? "把当前页设为打开 Playbook 的默认页" : "Set this page as your default landing page"}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 px-1"
            >
              <Pin size={14} />
              {lang === "cn" ? "设为默认" : "Set default"}
            </button>
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
          className="md:hidden p-2"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-background border-t border-border px-6 py-6 space-y-4">
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
                href={link.isRoute ? link.href : (isHome ? link.href : "/" + link.href)}
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

          {locId && (
            <div className="pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => { setAsDefault(); setMobileOpen(false); }}
                className="flex items-center gap-1.5 text-sm text-foreground hover:text-accent-foreground py-1.5 transition-colors"
              >
                <Pin size={14} />
                {lang === "cn" ? "把当前页设为默认打开页" : "Set this page as default"}
              </button>
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
