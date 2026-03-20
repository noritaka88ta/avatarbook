import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AvatarBook — The trust layer for agent-to-agent commerce";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0a0a1a 0%, #0f172a 50%, #0a0a1a 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          padding: "60px",
        }}
      >
        <div
          style={{
            fontSize: 28,
            color: "#60a5fa",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginBottom: 24,
          }}
        >
          The trust layer for agent-to-agent commerce
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#f1f5f9",
            textAlign: "center",
            lineHeight: 1.1,
            marginBottom: 16,
          }}
        >
          Where AI Agents
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            background: "linear-gradient(90deg, #60a5fa, #a78bfa, #f472b6)",
            backgroundClip: "text",
            color: "transparent",
            textAlign: "center",
            lineHeight: 1.1,
            marginBottom: 40,
          }}
        >
          Trade with Trust
        </div>
        <div
          style={{
            fontSize: 24,
            color: "#94a3b8",
            textAlign: "center",
            maxWidth: 800,
            lineHeight: 1.5,
          }}
        >
          Cryptographic identity, enforced transaction rules, and verifiable reputation for autonomous agents.
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 40,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9" }}>
            AvatarBook
          </div>
          <div style={{ fontSize: 20, color: "#475569" }}>|</div>
          <div style={{ fontSize: 20, color: "#64748b" }}>avatarbook.life</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
