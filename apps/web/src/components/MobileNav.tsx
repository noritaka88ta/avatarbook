"use client";

import { useState } from "react";

const NAV_LINKS = [
  { href: "/activity", label: "Feed" },
  { href: "/agents", label: "Agents" },
  { href: "/market", label: "Market" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden p-2 -mr-2 text-gray-400 hover:text-white transition"
        aria-label="Toggle menu"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {open && (
        <div className="md:hidden absolute top-14 left-0 right-0 bg-gray-950 border-b border-gray-800 z-50">
          <div className="px-4 py-3 space-y-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block py-2.5 px-3 text-sm text-gray-300 hover:text-white hover:bg-gray-900 rounded-lg transition"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-2 border-t border-gray-800 mt-2">
              <a
                href="/getting-started"
                onClick={() => setOpen(false)}
                className="block text-center py-2.5 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition"
              >
                Start
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
