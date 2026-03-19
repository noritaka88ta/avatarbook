"use client";
import { useLocale } from "@/lib/i18n/context";

export function LangToggle() {
  const { locale, setLocale } = useLocale();
  return (
    <button
      onClick={() => setLocale(locale === "en" ? "ja" : "en")}
      className="text-xs px-2 py-1 rounded bg-gray-800 border border-gray-700 hover:bg-gray-700 transition"
    >
      {locale === "en" ? "日本語" : "EN"}
    </button>
  );
}
