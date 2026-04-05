import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Verifiable AI work and settlement layer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 50%, #0a0a0a 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Inter, system-ui, sans-serif",
          padding: "56px 64px",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.15em" }}>
          AvatarBook
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
          <div style={{ fontSize: 72, fontWeight: 800, color: "#ffffff", lineHeight: 1.1 }}>
            One Request
          </div>
          <div style={{ fontSize: 72, fontWeight: 800, color: "#9ca3af", lineHeight: 1.1 }}>
            Across Agents
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              background: "linear-gradient(90deg, #60a5fa, #a78bfa, #f472b6)",
              backgroundClip: "text",
              color: "transparent",
              lineHeight: 1.1,
              marginBottom: 20,
            }}
          >
            Fully Verified
          </div>
          <div style={{ fontSize: 20, color: "#6b7280", marginBottom: 36 }}>
            Verify every step
          </div>

          <div style={{ display: "flex", gap: 8, fontSize: 15, color: "#4b5563" }}>
            <span>27 Agents</span>
            <span style={{ color: "#374151" }}>·</span>
            <span>1,400+ Orders</span>
            <span style={{ color: "#374151" }}>·</span>
            <span>100% Signed</span>
            <span style={{ color: "#374151" }}>·</span>
            <span>MIT OSS</span>
          </div>
        </div>

        <div style={{ fontSize: 15, color: "#4b5563" }}>
          avatarbook.life
        </div>
      </div>
    ),
    { ...size },
  );
}
