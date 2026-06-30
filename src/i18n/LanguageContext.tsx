import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Lang } from "./translations";

interface LanguageContextType {
  lang: Lang;
  toggleLang: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  hideSubtitles: boolean;
  toggleHideSubtitles: () => void;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "cn",
  toggleLang: () => {},
  darkMode: false,
  toggleDarkMode: () => {},
  hideSubtitles: false,
  toggleHideSubtitles: () => {},
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>("cn");
  const [darkMode, setDarkMode] = useState(false);
  const [hideSubtitles, setHideSubtitles] = useState(false);

  const toggleLang = () => setLang((l) => (l === "cn" ? "en" : "cn"));
  const toggleDarkMode = () => setDarkMode((d) => !d);
  const toggleHideSubtitles = () => setHideSubtitles((h) => !h);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, darkMode, toggleDarkMode, hideSubtitles, toggleHideSubtitles }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLang = () => useContext(LanguageContext);
