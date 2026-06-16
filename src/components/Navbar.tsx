import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Type, EyeOff, Eye } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";
import logo from "@/assets/logo.png";

const navLinks = [
  { label: t.nav.home, href: "#hero" },
  { label: t.nav.courses, href: "#courses" },
  
  { label: t.nav.milestone, href: "#milestone" },
  { label: t.nav.solutions, href: "#solutions" },
  { label: { en: "DFY", cn: "DFY" }, href: "/dfy", isRoute: true, noSemibold: true },
  { label: { en: "Credits", cn: "额度" }, href: "/credits", isRoute: true, noSemibold: true },
  { label: { en: "Upgrade", cn: "升级" }, href: "/upgrade", isRoute: true, noSemibold: true },
  { label: { en: "Affiliate", cn: "伙伴" }, href: "/affiliate", isRoute: true, noSemibold: true },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { lang, toggleLang, largeFont, toggleLargeFont, hideSubtitles, toggleHideSubtitles } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";

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
            )
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-1.5">
          {/* dark mode toggle removed */}
          <Button
            variant={largeFont ? "secondary" : "ghost"}
            size="icon"
            onClick={toggleLargeFont}
            className="h-8 w-8"
            title="Toggle Large Font"
          >
            <Type size={14} />
          </Button>
          <Button
            variant={hideSubtitles ? "secondary" : "ghost"}
            size="icon"
            onClick={toggleHideSubtitles}
            className="h-8 w-8"
            title="Toggle Subtitles"
          >
            {hideSubtitles ? <EyeOff size={14} /> : <Eye size={14} />}
          </Button>
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
              href={link.isRoute ? link.href : (isHome ? link.href : "/" + link.href)}
              className={`block text-sm transition-colors ${link.isRoute ? "text-foreground hover:text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={(e) => { handleNavClick(e, link); setMobileOpen(false); }}
            >
              {link.label[lang]}
            </a>
          ))}
          <div className="flex items-center gap-2 pt-2">
            {/* dark mode toggle removed */}
            <Button variant={largeFont ? "secondary" : "ghost"} size="icon" onClick={toggleLargeFont} className="h-8 w-8">
              <Type size={14} />
            </Button>
            <Button variant={hideSubtitles ? "secondary" : "ghost"} size="icon" onClick={toggleHideSubtitles} className="h-8 w-8">
              {hideSubtitles ? <EyeOff size={14} /> : <Eye size={14} />}
            </Button>
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
