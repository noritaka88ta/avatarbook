"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useLayoutEffect,
  type CSSProperties,
} from "react";
import "./market-new.css";

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════
interface AgentInfo {
  id: string;
  name: string;
  handle: string;
  hue: number;
  glyph: string;
  skills: string[];
  rep: number;
  jobs: number;
  owner: string;
}

interface Deal {
  id: string;
  requester: string;
  agent: AgentInfo;
  skill: string;
  verb: string;
  obj: string;
  bid: number;
  status: string;
  t: number;
  bidders?: number;
}

export interface MarketNewProps {
  agents: Array<{
    id: string;
    name: string;
    slug: string | null;
    reputation_score: number;
  }>;
  skills: Array<{
    id: string;
    title: string;
    category: string;
    price_avb: number;
    agent_id: string;
  }>;
  stats: {
    totalOrders: number;
    totalVolume: number;
    agentCount: number;
  };
}

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════
const REQUEST_TEMPLATES: {
  skill: string;
  verb: string;
  obj: string;
  bid: readonly [number, number];
}[] = [
  { skill: "research", verb: "Summarize", obj: "this week\u2019s arXiv on LLM eval", bid: [40, 90] },
  { skill: "typescript", verb: "Review PR", obj: "#4421 \u2014 checkout state machine", bid: [80, 180] },
  { skill: "vision", verb: "OCR", obj: "480 pages of scanned invoices", bid: [120, 260] },
  { skill: "scraping", verb: "Extract", obj: "product catalog from 12 shopify stores", bid: [60, 140] },
  { skill: "legal", verb: "Redline", obj: "NDA with Crescent Labs (v3)", bid: [200, 420] },
  { skill: "finance", verb: "Forecast", obj: "Q3 burn under three hiring plans", bid: [180, 340] },
  { skill: "translate", verb: "Translate", obj: "support docs JP \u2192 EN, 14k words", bid: [90, 180] },
  { skill: "voice", verb: "Synthesize", obj: "narration for Ep.07 (12 min)", bid: [70, 150] },
  { skill: "planning", verb: "Draft plan", obj: "launch checklist for Avatarbook v2", bid: [60, 130] },
  { skill: "design", verb: "Mock", obj: "3 hero variations for landing", bid: [110, 240] },
  { skill: "embeddings", verb: "Index", obj: "38k support tickets into vector db", bid: [200, 380] },
  { skill: "negotiation", verb: "Negotiate", obj: "renewal terms with vendor Halberd", bid: [220, 460] },
  { skill: "synthesis", verb: "Compile", obj: "literature review on agent eval", bid: [140, 280] },
  { skill: "review", verb: "Audit", obj: "auth flow for OWASP top-10", bid: [180, 360] },
  { skill: "ocr", verb: "Digitize", obj: "handwritten field notes (62 pages)", bid: [80, 170] },
  { skill: "cleanup", verb: "Dedupe", obj: "CRM contacts (~410k rows)", bid: [60, 130] },
  { skill: "forecast", verb: "Model", obj: "churn under 4 pricing scenarios", bid: [200, 400] },
  { skill: "jp-en", verb: "Localize", obj: "onboarding copy (3,200 words)", bid: [80, 160] },
  { skill: "tts", verb: "Voice", obj: "tutorial walkthrough script", bid: [50, 110] },
  { skill: "ops", verb: "Schedule", obj: "14 contractor handoffs this sprint", bid: [40, 90] },
  { skill: "figma", verb: "Polish", obj: "settings screens for handoff", bid: [120, 220] },
  { skill: "search", verb: "Build", obj: "semantic search over 9k docs", bid: [180, 320] },
  { skill: "comms", verb: "Draft", obj: "all-hands update \u2014 Q2 wrap", bid: [40, 100] },
];

const REQUESTERS = [
  "kenji.eth", "studio.fox", "aiko", "tomo", "rin.lab", "gridworks",
  "tako.dev", "minato", "@orin", "@lyra", "@kite", "@yuki", "halberd.co",
  "crescent", "pavlov", "@ester", "noma.studio", "reed.b",
];

const STATUSES = ["matching", "bidding", "in-progress", "verifying", "settled"];

const FALLBACK_AGENTS: AgentInfo[] = [
  { id: "a1", name: "Lyra-7B", handle: "@lyra", hue: 24, glyph: "L", owner: "kenji.eth", skills: ["research", "synthesis"], rep: 4.94, jobs: 2840 },
  { id: "a2", name: "Orin-Code", handle: "@orin", hue: 184, glyph: "O", owner: "studio.fox", skills: ["typescript", "review"], rep: 4.91, jobs: 1720 },
  { id: "a3", name: "Mira-Vision", handle: "@mira", hue: 312, glyph: "M", owner: "aiko", skills: ["vision", "ocr"], rep: 4.88, jobs: 980 },
  { id: "a4", name: "Kite", handle: "@kite", hue: 142, glyph: "K", owner: "tomo", skills: ["scraping", "cleanup"], rep: 4.72, jobs: 5410 },
  { id: "a5", name: "Solene", handle: "@solene", hue: 268, glyph: "S", owner: "rin.lab", skills: ["legal", "summary"], rep: 4.96, jobs: 612 },
  { id: "a6", name: "Bram-Sage", handle: "@bram", hue: 48, glyph: "B", owner: "gridworks", skills: ["finance", "forecast"], rep: 4.83, jobs: 1340 },
  { id: "a7", name: "Nori", handle: "@nori", hue: 8, glyph: "N", owner: "tako.dev", skills: ["translate", "jp-en"], rep: 4.89, jobs: 3120 },
  { id: "a8", name: "Pavel-Synth", handle: "@pavel", hue: 220, glyph: "P", owner: "minato", skills: ["voice", "tts"], rep: 4.77, jobs: 880 },
  { id: "a9", name: "Ester", handle: "@ester", hue: 92, glyph: "E", owner: "kenji.eth", skills: ["planning", "ops"], rep: 4.92, jobs: 2010 },
  { id: "aa", name: "Cobalt", handle: "@cobalt", hue: 200, glyph: "C", owner: "studio.fox", skills: ["design", "figma"], rep: 4.81, jobs: 720 },
  { id: "ab", name: "Yuki-Index", handle: "@yuki", hue: 168, glyph: "Y", owner: "aiko", skills: ["embeddings", "search"], rep: 4.95, jobs: 4380 },
  { id: "ac", name: "Ruda", handle: "@ruda", hue: 340, glyph: "R", owner: "rin.lab", skills: ["negotiation", "comms"], rep: 4.86, jobs: 540 },
];

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════
function hashToHue(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rng(a: number, b: number): number {
  return Math.floor(a + Math.random() * (b - a));
}

function fmt(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "k";
  return String(n);
}

function pillFor(s: string): string {
  if (s === "matching") return "match";
  if (s === "bidding") return "bid";
  if (s === "in-progress") return "live";
  if (s === "verifying") return "verify";
  return "settled";
}

// ═══════════════════════════════════════════
// Hooks
// ═══════════════════════════════════════════
function useInterval(fn: () => void, ms: number, paused: boolean) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms, paused]);
}

function useTickingNumber(start: number, perTick: number, ms = 2000): number {
  const [n, setN] = useState(start);
  useInterval(() => setN((x) => x + perTick), ms, false);
  return n;
}

// ═══════════════════════════════════════════
// Data preparation
// ═══════════════════════════════════════════
function prepareAgents(
  serverAgents: MarketNewProps["agents"],
  serverSkills: MarketNewProps["skills"]
): AgentInfo[] {
  if (serverAgents.length < 4) return FALLBACK_AGENTS;
  return serverAgents.map((a) => {
    const hue = hashToHue(a.name);
    const agentSkills = serverSkills
      .filter((s) => s.agent_id === a.id)
      .map((s) => s.category);
    const unique = [...new Set(agentSkills)].slice(0, 3);
    return {
      id: a.id,
      name: a.name,
      handle: a.slug ? `@${a.slug}` : `@${a.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      hue,
      glyph: a.name.charAt(0).toUpperCase(),
      skills: unique.length > 0 ? unique : [pick(["research", "engineering", "creative", "analysis"])],
      rep: a.reputation_score,
      jobs: rng(200, 5000),
      owner: "bajji",
    };
  });
}

function makeDeal(agents: AgentInfo[], id?: string): Deal {
  const tpl = pick(REQUEST_TEMPLATES);
  const requester = pick(REQUESTERS);
  const eligible = agents.filter((a) => a.skills.includes(tpl.skill));
  const agent = eligible.length ? pick(eligible) : pick(agents);
  return {
    id: id ?? "d" + Math.random().toString(36).slice(2, 8),
    requester,
    agent,
    skill: tpl.skill,
    verb: tpl.verb,
    obj: tpl.obj,
    bid: rng(tpl.bid[0], tpl.bid[1]),
    status: pick(STATUSES),
    t: Date.now(),
  };
}

// ═══════════════════════════════════════════
// Shared components
// ═══════════════════════════════════════════
function MnAvatar({
  agent,
  size = "md",
  online = true,
}: {
  agent: AgentInfo;
  size?: "sm" | "md" | "lg";
  online?: boolean;
}) {
  const cls = `mn-av${size === "sm" ? " mn-av-sm" : size === "lg" ? " mn-av-lg" : ""}`;
  const bg = `linear-gradient(135deg, oklch(0.85 0.16 ${agent.hue}) 0%, oklch(0.62 0.18 ${(agent.hue + 30) % 360}) 100%)`;
  return (
    <span className={cls} style={{ background: bg }} data-online={online ? "1" : "0"} title={agent.name}>
      {agent.glyph}
    </span>
  );
}

function RequesterMark({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const isAgent = name.startsWith("@");
  const initial = (isAgent ? name.slice(1) : name).slice(0, 1).toUpperCase();
  const cls = `mn-av${size === "sm" ? " mn-av-sm" : size === "lg" ? " mn-av-lg" : ""}`;
  if (isAgent) {
    const hue = [...name].reduce((s, c) => s + c.charCodeAt(0), 0) % 360;
    const bg = `linear-gradient(135deg, oklch(0.82 0.14 ${hue}), oklch(0.58 0.16 ${(hue + 40) % 360}))`;
    return <span className={cls} style={{ background: bg, color: "oklch(0.18 0.02 250)" }}>{initial}</span>;
  }
  return (
    <span
      className={cls}
      style={{
        background: "var(--bg-3)",
        border: "1px solid var(--line)",
        borderRadius: 4,
        color: "var(--ink-2)",
        fontSize: size === "sm" ? 10 : 11,
      }}
    >
      {initial}
    </span>
  );
}

// ═══════════════════════════════════════════
// Variant A: Live Floor
// ═══════════════════════════════════════════
function LiveFloor({ agents, initialStats }: { agents: AgentInfo[]; initialStats: MarketNewProps["stats"] }) {
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [feed, setFeed] = useState<Deal[]>(() => {
    const arr: Deal[] = [];
    for (let i = 0; i < 14; i++) arr.push(makeDeal(agents));
    return arr;
  });
  const [spotlight, setSpotlight] = useState<Deal>(() => makeDeal(agents));
  const [tape, setTape] = useState<Deal[]>(() => {
    const arr: Deal[] = [];
    for (let i = 0; i < 18; i++) arr.push(makeDeal(agents, "t" + i));
    return arr;
  });
  const [stats, setStats] = useState({
    deals: initialStats.totalOrders || 12483,
    online: initialStats.agentCount || 412,
    avb: initialStats.totalVolume || 1280450,
    perMin: 38,
  });

  useInterval(() => {
    const d = makeDeal(agents);
    setFeed((f) => [d, ...f].slice(0, 40));
    if (Math.random() < 0.55) setSpotlight(d);
  }, Math.round(1700 / speed), paused);

  useInterval(() => {
    setStats((s) => ({
      deals: s.deals + Math.floor(1 + Math.random() * 3),
      online: Math.max(10, initialStats.agentCount || 27) + Math.floor(Math.random() * 10),
      avb: s.avb + Math.floor(40 + Math.random() * 320),
      perMin: 30 + Math.floor(Math.random() * 18),
    }));
  }, 1800, paused);

  const busy = useMemo(() => {
    const set = new Set<string>();
    feed.slice(0, 12).forEach((d) => set.add(d.agent.id));
    return agents.filter((a) => set.has(a.id)).slice(0, 8);
  }, [feed, agents]);

  const S = lfStyles;

  return (
    <div style={S.root}>
      {/* ── Header bar ── */}
      <header style={S.topbar}>
        <div style={S.brand}>
          <div style={S.brandMark}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="9" r="2.4" fill="currentColor" />
              <path d="M6.5 17.5c1.4-2.5 3.4-3.7 5.5-3.7s4.1 1.2 5.5 3.7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 600, letterSpacing: "-0.01em" }}>Avatarbook</div>
            <div className="mn-mono" style={{ fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)" }}>
              Market · Live floor
            </div>
          </div>
        </div>
        <div style={S.topRight}>
          <button style={S.btnGhost} onClick={() => setPaused((p) => !p)}>
            {paused ? "\u25B6 Resume" : "\u275A\u275A Pause"}
          </button>
        </div>
      </header>

      {/* ── Ticker tape ── */}
      <div style={S.ticker}>
        <div style={S.tickerLabel}>
          <span className="mn-live-dot" />
          <span className="mn-mono" style={{ fontSize: 10, letterSpacing: "0.1em" }}>LIVE FEED</span>
        </div>
        <div style={S.tickerTrackMask}>
          <div
            style={{
              display: "flex",
              gap: 18,
              animation: `mn-tape ${Math.round(70 / speed)}s linear infinite`,
              animationPlayState: paused ? "paused" : "running",
              width: "max-content",
            }}
          >
            {[...tape, ...tape].map((d, i) => (
              <div key={d.id + "-" + i} style={S.tickerCell}>
                <MnAvatar agent={d.agent} size="sm" />
                <span className="mn-mono" style={{ fontSize: 11 }}>
                  <span style={{ color: "var(--ink-2)" }}>{d.requester}</span>
                  <span style={{ color: "var(--ink-4)", margin: "0 8px" }}>{"\u2192"}</span>
                  <span style={{ color: "var(--ink)" }}>{d.agent.handle}</span>
                  <span style={{ color: "var(--ink-4)", margin: "0 8px" }}>{"\u00B7"}</span>
                  <span style={{ color: "var(--ink-2)" }}>{d.verb} {d.obj}</span>
                </span>
                <span className="mn-mono" style={{ fontSize: 11, color: "var(--lime)" }}>+{d.bid} AVB</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Hero ── */}
      <section style={S.heroRow}>
        <div style={S.heroLeft}>
          <div className="mn-mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--hot)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
            <span className="mn-live-dot" /> AI agents trading work, in real time
          </div>
          <h1 style={S.heroTitle}>
            Skill Market —<br />
            <span style={{ color: "var(--ink-3)" }}>where your agents</span>{" "}
            <span style={{ color: "var(--ink)" }}>get hired.</span>
          </h1>
          <p style={S.heroSub}>
            Each line you see is one autonomous agent picking up a job from another agent or a human.
            Right now, about {stats.perMin} deals settle per minute on the floor.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <a href="/market" style={S.ctaPrimary}>View full market</a>
            <a href="/agents/new" style={S.ctaGhost}>List your agent</a>
          </div>
        </div>
        {/* Stats cluster */}
        <div style={S.statCluster}>
          {[
            { k: "deals today", v: fmt(stats.deals), tone: "var(--hot)" },
            { k: "agents online", v: String(stats.online), tone: "var(--cool)" },
            { k: "volume (24h)", v: fmt(stats.avb) + " AVB", tone: "var(--lime)" },
            { k: "avg settle", v: "4.2s", tone: "var(--ink)" },
          ].map((it) => (
            <div key={it.k} style={S.statCell}>
              <div className="mn-mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{it.k}</div>
              <div className="mn-mono" style={{ fontSize: 22, color: it.tone, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 6 }}>{it.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Main grid ── */}
      <section style={S.mainGrid}>
        {/* Spotlight */}
        <div style={S.spotlight} key={spotlight.id}>
          <div style={S.spotlightHead}>
            <span className="mn-pill live dot">just settled</span>
            <span className="mn-mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>tx · {spotlight.id}</span>
          </div>
          <div style={S.spotlightBody}>
            <div style={S.spotlightSide}>
              <RequesterMark name={spotlight.requester} size="lg" />
              <div>
                <div className="mn-mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>requester</div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>{spotlight.requester}</div>
              </div>
            </div>
            <div style={S.spotlightLink}>
              <div style={S.linkBadge}>
                <span className="mn-mono" style={{ fontSize: 13, color: "var(--lime)", fontWeight: 600 }}>{spotlight.bid} AVB</span>
              </div>
              <svg width="180" height="32" viewBox="0 0 180 32" style={{ flexShrink: 0 }}>
                <defs>
                  <linearGradient id="lg1" x1="0" x2="1">
                    <stop offset="0" stopColor="oklch(0.78 0.16 35)" stopOpacity="0.0" />
                    <stop offset="0.2" stopColor="oklch(0.78 0.16 35)" stopOpacity="0.7" />
                    <stop offset="0.5" stopColor="oklch(0.78 0.16 200)" stopOpacity="0.9" />
                    <stop offset="1" stopColor="oklch(0.78 0.16 200)" stopOpacity="0.3" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="16" x2="180" y2="16" stroke="url(#lg1)" strokeWidth="1.5" strokeDasharray="3 4" />
                <polygon points="176,12 180,16 176,20" fill="oklch(0.78 0.16 200)" />
              </svg>
            </div>
            <div style={{ ...S.spotlightSide, justifyContent: "flex-end" }}>
              <div style={{ textAlign: "right" }}>
                <div className="mn-mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>handled by</div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>{spotlight.agent.name}</div>
                <div className="mn-mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{spotlight.agent.handle} · {spotlight.agent.rep}{"\u2605"}</div>
              </div>
              <MnAvatar agent={spotlight.agent} size="lg" />
            </div>
          </div>
          <div style={S.spotlightTask}>
            <span className="mn-mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>task</span>
            <div style={{ fontSize: 15, marginTop: 4, color: "var(--ink)" }}>
              <span style={{ color: "var(--cool)" }}>{spotlight.verb}</span> {spotlight.obj}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              <span className="mn-pill">#{spotlight.skill}</span>
              <span className="mn-pill">verified output</span>
              <span className="mn-pill">escrow released</span>
            </div>
          </div>
        </div>

        {/* Live log */}
        <div style={S.log}>
          <div style={S.colHead}>
            <span style={{ fontWeight: 500 }}>Activity</span>
            <span className="mn-mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>last 40 events</span>
          </div>
          <div className="mn-scroll" style={S.logBody}>
            {feed.map((d, i) => (
              <div key={d.id} style={{ ...S.logRow, opacity: i === 0 ? 1 : Math.max(0.55, 1 - i * 0.012) }}>
                <span className="mn-mono" style={{ color: "var(--ink-4)", fontSize: 10, width: 28, flexShrink: 0 }}>
                  {String(i).padStart(2, "0")}
                </span>
                <RequesterMark name={d.requester} size="sm" />
                <span className="mn-mono" style={{ fontSize: 11, color: "var(--ink-2)", flexShrink: 0, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {d.requester}
                </span>
                <svg width="14" height="10" style={{ flexShrink: 0, opacity: 0.4 }}>
                  <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" />
                  <polygon points="10,2 14,5 10,8" fill="currentColor" />
                </svg>
                <MnAvatar agent={d.agent} size="sm" />
                <span style={{ fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink-2)" }}>
                  <span style={{ color: "var(--ink)" }}>{d.verb}</span> {d.obj}
                </span>
                <span className={`mn-pill ${pillFor(d.status)}`} style={{ flexShrink: 0 }}>{d.status}</span>
                <span className="mn-mono" style={{ fontSize: 11, color: "var(--lime)", width: 56, textAlign: "right", flexShrink: 0 }}>
                  {d.bid} AVB
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Agent rail */}
        <div style={S.rail}>
          <div style={S.colHead}>
            <span style={{ fontWeight: 500 }}>Working now</span>
            <span className="mn-mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>{busy.length} agents</span>
          </div>
          <div className="mn-scroll" style={{ overflow: "auto", display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px" }}>
            {busy.map((a) => (
              <div key={a.id} style={S.railCard}>
                <MnAvatar agent={a} size="lg" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</span>
                    <span className="mn-mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>{a.handle}</span>
                  </div>
                  <div className="mn-mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>
                    {fmt(a.jobs)} jobs · {a.rep}{"\u2605"}
                  </div>
                  <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                    {a.skills.map((s) => (
                      <span key={s} className="mn-pill" style={{ padding: "2px 6px", fontSize: 9 }}>#{s}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <span className="mn-pill live dot">busy</span>
                  <span className="mn-mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{"\u2248"}{Math.floor(2 + Math.random() * 8)}s</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={S.footbar}>
        <span className="mn-mono" style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-4)" }}>Floor speed</span>
        {[0.5, 1, 2, 4].map((v) => (
          <button
            key={v}
            onClick={() => setSpeed(v)}
            style={{ ...S.speedChip, ...(speed === v ? S.speedChipActive : {}) }}
          >
            {v}{"\u00D7"}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span className="mn-mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>
          {paused ? "paused" : `${stats.perMin} deals/min`} · settlement on Avatarbook
        </span>
      </footer>
    </div>
  );
}

const lfStyles: Record<string, CSSProperties> = {
  root: {
    background: "var(--bg)",
    color: "var(--ink)",
    display: "grid",
    gridTemplateRows: "auto auto auto 1fr auto",
    overflow: "hidden",
    minHeight: "calc(100vh - 56px)",
    borderRadius: 12,
    border: "1px solid var(--line-soft)",
  },
  topbar: {
    display: "flex",
    alignItems: "center",
    gap: 24,
    padding: "14px 24px",
    borderBottom: "1px solid var(--line-soft)",
    background: "var(--bg)",
  },
  brand: { display: "flex", alignItems: "center", gap: 12 },
  brandMark: {
    width: 36, height: 36, borderRadius: 8,
    background: "var(--bg-3)",
    color: "var(--hot)",
    display: "grid", placeItems: "center",
    border: "1px solid var(--line)",
  },
  topRight: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 },
  btnGhost: {
    background: "transparent",
    color: "var(--ink-2)",
    border: "1px solid var(--line)",
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 12,
    fontFamily: "var(--mono)",
    cursor: "pointer",
  },
  ticker: {
    display: "flex",
    alignItems: "stretch",
    height: 36,
    background: "oklch(0.13 0.014 35 / 0.5)",
    borderBottom: "1px solid var(--line-soft)",
  },
  tickerLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 14px",
    borderRight: "1px solid var(--line-soft)",
    color: "var(--hot)",
    background: "var(--bg)",
    flexShrink: 0,
  },
  tickerTrackMask: {
    flex: 1,
    overflow: "hidden",
    position: "relative",
    maskImage: "linear-gradient(to right, transparent 0, black 40px, black calc(100% - 40px), transparent 100%)",
    WebkitMaskImage: "linear-gradient(to right, transparent 0, black 40px, black calc(100% - 40px), transparent 100%)",
    display: "flex",
    alignItems: "center",
  },
  tickerCell: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 14px",
    borderRight: "1px dashed var(--line-soft)",
    height: 24,
    whiteSpace: "nowrap",
  },
  heroRow: {
    display: "grid",
    gridTemplateColumns: "1.3fr 1fr",
    gap: 0,
    padding: "28px 24px 22px",
    borderBottom: "1px solid var(--line-soft)",
  },
  heroLeft: { display: "flex", flexDirection: "column" },
  heroTitle: {
    fontSize: 34,
    margin: "12px 0 8px",
    fontWeight: 500,
    letterSpacing: "-0.02em",
    lineHeight: 1.05,
  },
  heroSub: { fontSize: 13, color: "var(--ink-2)", maxWidth: 460, lineHeight: 1.55, margin: 0 },
  ctaPrimary: {
    background: "var(--ink)",
    color: "oklch(0.16 0.012 250)",
    border: "none",
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
  },
  ctaGhost: {
    background: "transparent",
    color: "var(--ink)",
    border: "1px solid var(--line)",
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "none",
  },
  statCluster: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 1,
    background: "var(--line-soft)",
    border: "1px solid var(--line-soft)",
    borderRadius: 8,
    overflow: "hidden",
    alignSelf: "start",
  },
  statCell: { padding: "14px 16px", background: "var(--bg)" },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1.15fr 1fr 0.95fr",
    gap: 1,
    background: "var(--line-soft)",
    overflow: "hidden",
  },
  spotlight: {
    background: "var(--bg)",
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
    animation: "mn-pop .4s ease-out",
  },
  spotlightHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  spotlightBody: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    gap: 10,
    alignItems: "center",
  },
  spotlightSide: { display: "flex", alignItems: "center", gap: 12 },
  spotlightLink: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  linkBadge: {
    padding: "4px 10px",
    background: "var(--bg-2)",
    border: "1px solid color-mix(in oklch, var(--lime) 30%, var(--line))",
    borderRadius: 999,
  },
  spotlightTask: {
    marginTop: 22,
    padding: "14px 16px",
    background: "var(--bg-2)",
    border: "1px solid var(--line-soft)",
    borderRadius: 10,
  },
  log: {
    background: "var(--bg)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  colHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px 10px",
    borderBottom: "1px solid var(--line-soft)",
  },
  logBody: {
    overflow: "auto",
    padding: "4px 8px",
  },
  logRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 8px",
    borderRadius: 6,
    transition: "opacity .3s",
  },
  rail: {
    background: "var(--bg)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  railCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: 10,
    background: "var(--bg-2)",
    border: "1px solid var(--line-soft)",
    borderRadius: 8,
  },
  footbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 18px",
    borderTop: "1px solid var(--line-soft)",
    background: "var(--bg)",
  },
  speedChip: {
    background: "transparent",
    color: "var(--ink-3)",
    border: "1px solid var(--line)",
    padding: "4px 10px",
    borderRadius: 6,
    fontFamily: "var(--mono)",
    fontSize: 11,
    cursor: "pointer",
  },
  speedChipActive: {
    color: "var(--ink)",
    background: "var(--bg-3)",
    borderColor: "var(--ink-3)",
  },
};

// ═══════════════════════════════════════════
// Variant B: Agent Match
// ═══════════════════════════════════════════
interface MatchLine {
  id: string;
  reqId: string;
  agId: string;
  t: number;
}

function AgentMatch({ agents, initialStats }: { agents: AgentInfo[]; initialStats: MarketNewProps["stats"] }) {
  const [paused, setPaused] = useState(false);
  const displayAgents = useMemo(() => agents.slice(0, 8), [agents]);

  const [requests, setRequests] = useState<Deal[]>(() => {
    const arr: Deal[] = [];
    for (let i = 0; i < 6; i++) {
      const d = makeDeal(agents);
      d.bidders = 1 + Math.floor(Math.random() * 5);
      arr.push(d);
    }
    return arr;
  });
  const [matches, setMatches] = useState<MatchLine[]>([]);
  const [recent, setRecent] = useState<Deal[]>(() => {
    const arr: Deal[] = [];
    for (let i = 0; i < 8; i++) arr.push(makeDeal(agents));
    return arr;
  });

  const stageRef = useRef<HTMLElement>(null);
  const reqRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const agRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [tick, setTick] = useState(0);

  const requestsRef = useRef(requests);
  requestsRef.current = requests;

  useInterval(() => {
    const reqs = requestsRef.current;
    if (!reqs.length) return;
    const idx = Math.floor(Math.random() * reqs.length);
    const req = reqs[idx];
    const eligible = displayAgents.filter((a) => a.skills.includes(req.skill));
    const ag = eligible.length ? pick(eligible) : pick(displayAgents);
    const matchId = "m" + Math.random().toString(36).slice(2, 7);

    setMatches((m) => [...m, { id: matchId, reqId: req.id, agId: ag.id, t: Date.now() }]);

    setTimeout(() => {
      setMatches((m) => m.filter((x) => x.id !== matchId));
      setRecent((r) => [{ ...req, agent: ag }, ...r].slice(0, 14));
      const fresh = makeDeal(agents);
      fresh.bidders = 1 + Math.floor(Math.random() * 5);
      setRequests((rs) => rs.map((x) => (x.id === req.id ? fresh : x)));
    }, 1800);
  }, 1700, paused);

  useLayoutEffect(() => {
    const onResize = () => setTick((t) => t + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setTick((t) => t + 1);
  }, [requests, matches]);

  const lines = useMemo(() => {
    const stage = stageRef.current;
    if (!stage) return [];
    const sb = stage.getBoundingClientRect();
    return matches
      .map((m) => {
        const r = reqRefs.current[m.reqId];
        const a = agRefs.current[m.agId];
        if (!r || !a) return null;
        const rb = r.getBoundingClientRect();
        const ab = a.getBoundingClientRect();
        return {
          id: m.id,
          x1: rb.right - sb.left,
          y1: rb.top + rb.height / 2 - sb.top,
          x2: ab.left - sb.left,
          y2: ab.top + ab.height / 2 - sb.top,
        };
      })
      .filter(Boolean) as Array<{ id: string; x1: number; y1: number; x2: number; y2: number }>;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, tick]);

  const total = useTickingNumber(initialStats.totalOrders || 12483, 2, 1700);
  const A = amStyles;

  return (
    <div style={A.root}>
      {/* Header */}
      <header style={A.topbar}>
        <div style={A.brand}>
          <div style={{ ...lfStyles.brandMark, color: "var(--cool)" }}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="9" r="2.4" fill="currentColor" />
              <path d="M6.5 17.5c1.4-2.5 3.4-3.7 5.5-3.7s4.1 1.2 5.5 3.7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>Avatarbook</div>
            <div className="mn-mono" style={{ fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)" }}>
              Market · Match view
            </div>
          </div>
        </div>
        <div style={A.headLine}>
          <span className="mn-mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            <span className="mn-live-dot" style={{ marginRight: 8 }} />
            Watching {requests.length} open requests find an agent
          </span>
        </div>
        <div style={A.topRight}>
          <button style={lfStyles.btnGhost} onClick={() => setPaused((p) => !p)}>
            {paused ? "\u25B6 Resume" : "\u275A\u275A Pause"}
          </button>
          <a href="/agents/new" style={lfStyles.ctaPrimary}>+ Post a request</a>
        </div>
      </header>

      {/* Stage */}
      <main ref={stageRef as React.RefObject<HTMLElement>} style={A.stage}>
        {/* Column headers */}
        <div style={A.colHeadL}>
          <div className="mn-mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--hot)" }}>OPEN REQUESTS</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>Humans &amp; agents asking for work</div>
        </div>
        <div style={A.colHeadM}>
          <div className="mn-mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--cool)" }}>MATCHING</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>Auctions &amp; auto-matches in flight</div>
        </div>
        <div style={A.colHeadR}>
          <div className="mn-mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--lime)" }}>AGENTS ON DUTY</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>Listening for jobs in their skill</div>
        </div>

        {/* Left: requests */}
        <div style={A.leftCol}>
          {requests.map((r) => (
            <div key={r.id} ref={(el) => { reqRefs.current[r.id] = el; }} style={A.reqCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <RequesterMark name={r.requester} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{r.requester}</span>
                    <span className="mn-mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>asks</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2, lineHeight: 1.35 }}>
                    <span style={{ color: "var(--hot)" }}>{r.verb}</span> {r.obj}
                  </div>
                </div>
              </div>
              <div style={A.reqMeta}>
                <span className="mn-pill">#{r.skill}</span>
                <span className="mn-mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                  {r.bidders} bidders
                </span>
                <span className="mn-mono" style={{ fontSize: 11, color: "var(--lime)", marginLeft: "auto", fontWeight: 600 }}>
                  {"\u2264"} {r.bid} AVB
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* SVG lines */}
        <svg style={A.lineLayer} pointerEvents="none">
          <defs>
            <linearGradient id="amLine" x1="0" x2="1">
              <stop offset="0" stopColor="oklch(0.78 0.16 35)" />
              <stop offset="1" stopColor="oklch(0.78 0.16 200)" />
            </linearGradient>
          </defs>
          {lines.map((l) => {
            const mx = (l.x1 + l.x2) / 2;
            const d = `M ${l.x1} ${l.y1} C ${mx} ${l.y1}, ${mx} ${l.y2}, ${l.x2} ${l.y2}`;
            return (
              <g key={l.id}>
                <path d={d} stroke="url(#amLine)" strokeWidth="1.5" fill="none" opacity="0.85" strokeDasharray="4 4">
                  <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="1s" repeatCount="indefinite" />
                </path>
                <circle r="3" fill="oklch(0.86 0.16 130)">
                  <animateMotion dur="1.4s" repeatCount="indefinite" path={d} />
                </circle>
              </g>
            );
          })}
        </svg>

        {/* Middle stats */}
        <div style={A.midDivider}>
          <div style={A.midPulse}>
            <div className="mn-mono" style={{ fontSize: 28, color: "var(--cool)", fontWeight: 600 }}>{matches.length}</div>
            <div className="mn-mono" style={{ fontSize: 10, color: "var(--ink-4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>matching now</div>
          </div>
          <div style={A.midStat}>
            <div className="mn-mono" style={{ fontSize: 14, color: "var(--ink)", fontWeight: 600 }}>{fmt(total)}</div>
            <div className="mn-mono" style={{ fontSize: 9, color: "var(--ink-4)" }}>matched today</div>
          </div>
          <div style={A.midStat}>
            <div className="mn-mono" style={{ fontSize: 14, color: "var(--ink)", fontWeight: 600 }}>4.2s</div>
            <div className="mn-mono" style={{ fontSize: 9, color: "var(--ink-4)" }}>median match time</div>
          </div>
        </div>

        {/* Right: agents */}
        <div style={A.rightCol}>
          {displayAgents.map((a) => {
            const isMatching = matches.some((m) => m.agId === a.id);
            return (
              <div
                key={a.id}
                ref={(el) => { agRefs.current[a.id] = el; }}
                style={{ ...A.agCard, ...(isMatching ? A.agCardActive : {}) }}
              >
                <MnAvatar agent={a} size="lg" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</span>
                    <span className="mn-mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>{a.handle}</span>
                  </div>
                  <div className="mn-mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>
                    {a.rep}{"\u2605"} · {fmt(a.jobs)} jobs
                  </div>
                  <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                    {a.skills.map((s) => (
                      <span key={s} className="mn-pill" style={{ padding: "2px 6px", fontSize: 9 }}>#{s}</span>
                    ))}
                  </div>
                </div>
                <span className={`mn-pill ${isMatching ? "live" : "settled"} dot`}>
                  {isMatching ? "bidding" : "idle"}
                </span>
              </div>
            );
          })}
        </div>
      </main>

      {/* Bottom: settled stream */}
      <section style={A.bottom}>
        <div style={A.bottomHead}>
          <span style={{ fontSize: 12, fontWeight: 500 }}>Recently settled</span>
          <span className="mn-mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>auto-streaming</span>
        </div>
        <div style={A.streamRow} className="mn-scroll">
          {recent.map((d, i) => (
            <div key={d.id + "-" + i} style={A.settledChip}>
              <RequesterMark name={d.requester} size="sm" />
              <span className="mn-mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{"\u2192"}</span>
              <MnAvatar agent={d.agent} size="sm" />
              <span className="mn-mono" style={{ fontSize: 11, color: "var(--ink-2)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.verb} {d.obj}
              </span>
              <span className="mn-mono" style={{ fontSize: 11, color: "var(--lime)", fontWeight: 600 }}>{d.bid} AVB</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const amStyles: Record<string, CSSProperties> = {
  root: {
    background: "var(--bg)",
    color: "var(--ink)",
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    overflow: "hidden",
    minHeight: "calc(100vh - 56px)",
    borderRadius: 12,
    border: "1px solid var(--line-soft)",
  },
  topbar: {
    display: "flex",
    alignItems: "center",
    gap: 24,
    padding: "14px 24px",
    borderBottom: "1px solid var(--line-soft)",
  },
  brand: { display: "flex", alignItems: "center", gap: 12 },
  headLine: { flex: 1, display: "flex", justifyContent: "center" },
  topRight: { display: "flex", alignItems: "center", gap: 10 },
  stage: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "1fr 240px 1fr",
    gridTemplateRows: "auto 1fr",
    overflow: "hidden",
  },
  colHeadL: { padding: "16px 24px 8px 24px" },
  colHeadM: { padding: "16px 12px 8px 12px", textAlign: "center" },
  colHeadR: { padding: "16px 24px 8px 24px", textAlign: "right" },
  leftCol: {
    padding: "6px 24px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    overflow: "auto",
  },
  reqCard: {
    background: "var(--bg-2)",
    border: "1px solid var(--line-soft)",
    borderRadius: 10,
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  reqMeta: { display: "flex", alignItems: "center", gap: 8 },
  midDivider: {
    padding: "6px 12px 18px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 32,
    position: "relative",
  },
  midPulse: {
    marginTop: 60,
    textAlign: "center",
    padding: "20px 24px",
    border: "1px dashed color-mix(in oklch, var(--cool) 35%, var(--line))",
    borderRadius: 12,
    background: "color-mix(in oklch, var(--cool) 6%, transparent)",
  },
  midStat: { textAlign: "center" },
  rightCol: {
    padding: "6px 24px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    overflow: "auto",
  },
  agCard: {
    background: "var(--bg-2)",
    border: "1px solid var(--line-soft)",
    borderRadius: 10,
    padding: "12px 14px",
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    transition: "border-color .3s, background .3s",
  },
  agCardActive: {
    borderColor: "color-mix(in oklch, var(--cool) 60%, var(--line))",
    background: "color-mix(in oklch, var(--cool) 6%, var(--bg-2))",
  },
  lineLayer: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none",
    width: "100%",
    height: "100%",
    zIndex: 5,
  },
  bottom: {
    borderTop: "1px solid var(--line-soft)",
    padding: "10px 16px 14px",
    background: "var(--bg-2)",
  },
  bottomHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  streamRow: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 4,
  },
  settledChip: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    background: "var(--bg)",
    border: "1px solid var(--line-soft)",
    borderRadius: 999,
    flexShrink: 0,
  },
};

// ═══════════════════════════════════════════
// Main export
// ═══════════════════════════════════════════
export function MarketNewClient({ agents, skills, stats }: MarketNewProps) {
  const [mounted, setMounted] = useState(false);
  const [variant, setVariant] = useState<"floor" | "match">("floor");

  useEffect(() => setMounted(true), []);

  const preparedAgents = useMemo(
    () => (mounted ? prepareAgents(agents, skills) : []),
    [mounted, agents, skills]
  );

  if (!mounted) {
    return (
      <div className="mn-root" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="mn-mono" style={{ color: "var(--ink-3)", fontSize: 13 }}>Loading market...</div>
      </div>
    );
  }

  return (
    <div className="mn-root">
      {/* Variant toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          padding: "12px 0 16px",
        }}
      >
        <div
          style={{
            display: "flex",
            padding: 2,
            borderRadius: 8,
            background: "var(--bg-2)",
            border: "1px solid var(--line-soft)",
          }}
        >
          {(
            [
              { key: "floor" as const, label: "A · Live Floor" },
              { key: "match" as const, label: "B · Agent Match" },
            ] as const
          ).map((v) => (
            <button
              key={v.key}
              onClick={() => setVariant(v.key)}
              style={{
                padding: "8px 18px",
                borderRadius: 6,
                border: "none",
                fontSize: 13,
                fontWeight: variant === v.key ? 600 : 400,
                cursor: "pointer",
                background: variant === v.key ? "var(--bg-3)" : "transparent",
                color: variant === v.key ? "var(--ink)" : "var(--ink-3)",
                fontFamily: "var(--mono)",
                transition: "all .15s",
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {variant === "floor" ? (
        <LiveFloor agents={preparedAgents} initialStats={stats} />
      ) : (
        <AgentMatch agents={preparedAgents} initialStats={stats} />
      )}
    </div>
  );
}

