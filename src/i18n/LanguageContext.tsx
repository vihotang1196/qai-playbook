import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Lang } from "./translations";

interface LanguageContextType {
  lang: Lang;
  toggleLang: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  largeFont: boolean;
  toggleLargeFont: () => void;
  hideSubtitles: boolean;
  toggleHideSubtitles: () => void;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "cn",
  toggleLang: () => {},
  darkMode: false,
  toggleDarkMode: () => {},
  largeFont: false,
  toggleLargeFont: () => {},
  hideSubtitles: false,
  toggleHideSubtitles: () => {},
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>("cn");
  const [darkMode, setDarkMode] = useState(false);
  const [largeFont, setLargeFont] = useState(false);
  const [hideSubtitles, setHideSubtitles] = useState(false);

  const toggleLang = () => setLang((l) => (l === "cn" ? "en" : "cn"));
  const toggleDarkMode = () => setDarkMode((d) => !d);
  const toggleLargeFont = () => setLargeFont((f) => !f);
  const toggleHideSubtitles = () => setHideSubtitles((h) => !h);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.style.fontSize = largeFont ? "200%" : "";
  }, [largeFont]);

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, darkMode, toggleDarkMode, largeFont, toggleLargeFont, hideSubtitles, toggleHideSubtitles }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLang = () => useContext(LanguageContext);
