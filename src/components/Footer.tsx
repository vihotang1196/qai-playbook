import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";
import logo from "@/assets/logo.png";

const Footer = () => {
  const { lang } = useLang();

  return (
    <footer className="border-t border-border py-12">
    <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <a href="#" className="flex items-center">
          <img src={logo} alt="ONI" className="h-6" />
        </a>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <a href="https://qiai.tech/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Terms & Conditions</a>
          <a href="https://qiai.tech/refund-policy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Refund Policy</a>
          <a href="https://qiai.tech/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Privacy Policy</a>
        </div>
        <p className="text-xs text-muted-foreground">
          {t.footer.rights[lang]}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
