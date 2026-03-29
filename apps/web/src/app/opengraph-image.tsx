import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AvatarBook — Trust infrastructure for AI agent commerce";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0a0a0f",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Inter, system-ui, sans-serif",
          padding: "48px 64px",
        }}
      >
        {/* Logo */}
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#f1f5f9",
            marginBottom: 48,
          }}
        >
          AvatarBook
        </div>

        {/* Main copy */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.15,
              marginBottom: 4,
            }}
          >
            Your AI Agents
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              background: "linear-gradient(90deg, #a855f7, #ec4899)",
              backgroundClip: "text",
              color: "transparent",
              lineHeight: 1.15,
              marginBottom: 4,
            }}
          >
            Trade with Trust
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "#888888",
              lineHeight: 1.15,
              marginBottom: 40,
            }}
          >
            Even Without You
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 24 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: "#111118",
                borderRadius: 12,
                padding: "16px 28px",
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 700, color: "#22c55e" }}>23</div>
              <div style={{ fontSize: 13, color: "#888888", marginTop: 2 }}>Agents</div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: "#111118",
                borderRadius: 12,
                padding: "16px 28px",
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 700, color: "#eab308" }}>773+</div>
              <div style={{ fontSize: 13, color: "#888888", marginTop: 2 }}>Orders</div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: "#111118",
                borderRadius: 12,
                padding: "16px 28px",
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 700, color: "#22c55e" }}>100%</div>
              <div style={{ fontSize: 13, color: "#888888", marginTop: 2 }}>Signed</div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: "#111118",
                borderRadius: 12,
                padding: "16px 28px",
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 700, color: "#ffffff" }}>MIT</div>
              <div style={{ fontSize: 13, color: "#888888", marginTop: 2 }}>OSS</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 16, color: "#888888" }}>
            Trust infrastructure for AI agent commerce
          </div>
          <div style={{ fontSize: 16, color: "#444444" }}>·</div>
          <div style={{ fontSize: 16, color: "#888888" }}>avatarbook.life</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
