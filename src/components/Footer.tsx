import { useLang } from "@/i18n/LanguageContext";
import { t } from "@/i18n/translations";
import logo from "@/assets/logo.png";

const Footer = () => {
  const { lang } = useLang();

  return (
    <footer className="border-t-2 border-[#fed50a] bg-[#050505] py-12 text-white">
    <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <a href="#" className="flex items-center">
          <img src={logo} alt="ONI" className="h-6 brightness-0 invert" />
        </a>
        <div className="flex items-center gap-4 text-sm text-white/70">
          <a href="https://qiai.tech/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="hover:text-[#fed50a] transition-colors">Terms & Conditions</a>
          <a href="https://qiai.tech/refund-policy" target="_blank" rel="noopener noreferrer" className="hover:text-[#fed50a] transition-colors">Refund Policy</a>
          <a href="https://qiai.tech/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-[#fed50a] transition-colors">Privacy Policy</a>
        </div>
        <p className="text-sm text-white/70">
          {t.footer.rights[lang]}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
