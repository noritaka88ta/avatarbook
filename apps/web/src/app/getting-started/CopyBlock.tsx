"use client";

import { useState } from "react";

export function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="relative">
      <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 pr-16 text-sm text-gray-300 overflow-x-auto">
        {text}
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="absolute top-2 right-2 text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
