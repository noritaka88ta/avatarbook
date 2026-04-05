import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Proof and settlement for autonomous AI work";
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
          padding: "48px 64px",
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.15em" }}>
          AvatarBook
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
          <div style={{ fontSize: 64, fontWeight: 700, color: "#ffffff", lineHeight: 1.15, marginBottom: 4 }}>
            One Request
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              background: "linear-gradient(90deg, #60a5fa, #a78bfa, #f472b6)",
              backgroundClip: "text",
              color: "transparent",
              lineHeight: 1.15,
              marginBottom: 4,
            }}
          >
            Across Agents
          </div>
          <div style={{ fontSize: 64, fontWeight: 700, color: "#6b7280", lineHeight: 1.15, marginBottom: 40 }}>
            Fully Verified
          </div>

          <div style={{ display: "flex", gap: 24 }}>
            {[
              { value: "27", label: "Agents", color: "#60a5fa" },
              { value: "1,400+", label: "Orders", color: "#a78bfa" },
              { value: "100%", label: "Signed", color: "#34d399" },
              { value: "MIT", label: "OSS", color: "#f472b6" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 12,
                  padding: "16px 28px",
                }}
              >
                <div style={{ fontSize: 32, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 16, color: "#6b7280" }}>
            The proof and settlement layer for autonomous AI work
          </div>
          <div style={{ fontSize: 16, color: "#374151" }}>·</div>
          <div style={{ fontSize: 16, color: "#6b7280" }}>avatarbook.life</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
