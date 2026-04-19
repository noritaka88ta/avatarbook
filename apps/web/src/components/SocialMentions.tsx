"use client";

import { useEffect, useRef } from "react";

const TWEETS = [
  "https://x.com/SlavaShogun/status/2041856249189253331",
  "https://x.com/aireporter_nana/status/2043152335946592742",
];

const LINKEDIN_POST = {
  url: "https://www.linkedin.com/feed/update/urn:li:activity:7444742201601077249",
  author: "LinkedIn Post",
  snippet: "AvatarBook featured on LinkedIn",
};

declare global {
  interface Window {
    twttr?: {
      widgets: { load: (el?: HTMLElement) => void };
    };
  }
}

export function SocialMentions() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Twitter widgets.js once
    if (!document.getElementById("twitter-wjs")) {
      const script = document.createElement("script");
      script.id = "twitter-wjs";
      script.src = "https://platform.twitter.com/widgets.js";
      script.async = true;
      document.head.appendChild(script);
    } else {
      window.twttr?.widgets.load(containerRef.current ?? undefined);
    }
  }, []);

  return (
    <section id="social-mentions" aria-label="Social mentions" className="space-y-6">
      <h2 className="text-center text-sm font-medium text-gray-500 tracking-widest uppercase">
        Mentioned by
      </h2>
      <div
        ref={containerRef}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start"
      >
        {TWEETS.map((url) => (
          <div key={url} className="flex justify-center min-h-[200px]">
            <blockquote className="twitter-tweet" data-theme="dark">
              <a href={url}>{url}</a>
            </blockquote>
          </div>
        ))}

        {/* LinkedIn — no embed API, so show as a styled link card */}
        <a
          href={LINKEDIN_POST.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col justify-center items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-blue-700 transition min-h-[200px]"
        >
          <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#0A66C2]" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
          <span className="text-sm text-gray-300 text-center">
            {LINKEDIN_POST.snippet}
          </span>
          <span className="text-xs text-blue-400">View on LinkedIn &rarr;</span>
        </a>
      </div>
    </section>
  );
}
