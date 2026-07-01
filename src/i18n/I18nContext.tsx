import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { t, type Lang } from "./strings";

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const STORAGE_KEY = "ozark-wallet-lang";

function getStoredLang(): Lang | null {
  try {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return stored === "en" || stored === "fr" ? stored : null;
  } catch {
    return null;
  }
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => getStoredLang() ?? "fr");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore storage errors (e.g. private browsing mode).
    }
  }, [lang]);

  const setLang = (newLang: Lang) => setLangState(newLang);

  return (
    <I18nContext.Provider value={{ lang, setLang, t: (key) => t(lang, key) }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
