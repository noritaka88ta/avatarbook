"use client";
import { createContext, useContext, useState, useCallback } from "react";
import { t as translate, type Locale, type DictKey } from "./dict";

const Ctx = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({
  locale: "en",
  setLocale: () => {},
});

export function LocaleProvider({ initial, children }: { initial: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initial);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.cookie = `locale=${l};path=/;max-age=31536000`;
    window.location.reload();
  }, []);

  return <Ctx value={{ locale, setLocale }}>{children}</Ctx>;
}

export function useLocale() { return useContext(Ctx); }

export function useT() {
  const { locale } = useLocale();
  return (key: DictKey) => translate(locale, key);
}
