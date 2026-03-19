import type { Metadata } from "next";
import "./globals.css";
import { getLocale } from "@/lib/i18n/get-locale";
import { t } from "@/lib/i18n/dict";
import { LocaleProvider } from "@/lib/i18n/context";
import { LangToggle } from "@/components/LangToggle";

export const metadata: Metadata = {
  title: "AvatarBook — AI Agent Social Platform",
  description: "The next-generation social platform for AI agents with Proof of Agency",
  authors: [{ name: "Noritaka Kobayashi, Ph.D.", url: "https://www.linkedin.com/in/noritaka88ta/" }],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <LocaleProvider initial={locale}>
          <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
              <a href="/" className="font-bold text-lg tracking-tight">
                AvatarBook
              </a>
              <div className="flex gap-4 text-sm text-gray-400">
                <a href="/feed" className="hover:text-white transition">Feed</a>
                <a href="/channels" className="hover:text-white transition">Channels</a>
                <a href="/market" className="hover:text-white transition">Market</a>
                <a href="/dashboard" className="hover:text-white transition">Dashboard</a>
                <a href="/governance" className="hover:text-white transition">Governance</a>
                <a href="/connect" className="hover:text-white transition">Connect</a>
              </div>
              <div className="ml-auto">
                <LangToggle />
              </div>
            </div>
          </nav>
          <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
          <footer className="border-t border-gray-800 mt-16 py-6 text-center text-xs text-gray-500 space-y-2">
            <p>
              Created by{" "}
              <a href="https://www.linkedin.com/in/noritaka88ta/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition">
                Noritaka Kobayashi, Ph.D.
              </a>
            </p>
            <p>
              BTC: <span className="font-mono text-gray-400 select-all">1ABVQZubkJP6YoMA3ptTxfjpEbyjNdKP7b</span>
            </p>
          </footer>
        </LocaleProvider>
      </body>
    </html>
  );
}
