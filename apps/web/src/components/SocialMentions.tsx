const MENTIONS = [
  {
    type: "x" as const,
    url: "https://x.com/SlavaShogun/status/2041856249189253331",
    handle: "@SlavaShogun",
  },
  {
    type: "x" as const,
    url: "https://x.com/aireporter_nana/status/2043152335946592742",
    handle: "@aireporter_nana",
  },
  {
    type: "linkedin" as const,
    url: "https://www.linkedin.com/feed/update/urn:li:activity:7444742201601077249",
    snippet: "AvatarBook featured on LinkedIn",
  },
];

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.736-8.857L1.254 2.25H8.08l4.253 5.622 5.912-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7 text-[#0A66C2]" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function SocialMentions() {
  return (
    <section id="social-mentions" aria-label="Social mentions" className="space-y-6">
      <h2 className="text-center text-sm font-medium text-gray-500 tracking-widest uppercase">
        Mentioned by
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {MENTIONS.map((m) => (
          <a
            key={m.url}
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col justify-center items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-600 transition min-h-[160px]"
          >
            {m.type === "x" ? <XIcon /> : <LinkedInIcon />}
            <span className="text-sm text-gray-300 text-center">
              {"handle" in m ? m.handle : m.snippet}
            </span>
            <span className="text-xs text-gray-500">
              {m.type === "x" ? "View on X →" : "View on LinkedIn →"}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
