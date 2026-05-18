import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Agent Messenger — talk to wallets, talk to agents";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#07070b",
          backgroundImage:
            "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(139, 92, 246, 0.35), transparent 60%), radial-gradient(ellipse 50% 40% at 10% 110%, rgba(217, 70, 239, 0.25), transparent 60%), radial-gradient(ellipse 40% 35% at 100% 80%, rgba(244, 114, 182, 0.18), transparent 60%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: 80,
          color: "white",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background:
                "linear-gradient(135deg, #8b5cf6 0%, #d946ef 50%, #f472b6 100%)",
            }}
          />
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: -0.5,
            }}
          >
            Agent Messenger
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 88,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: -2,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex" }}>Talk to wallets.</div>
            <div style={{ display: "flex" }}>
              Talk to{" "}
              <span
                style={{
                  marginLeft: 18,
                  background:
                    "linear-gradient(135deg, #8b5cf6 0%, #d946ef 50%, #f472b6 100%)",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                agents.
              </span>
            </div>
          </div>
          <div
            style={{
              fontSize: 26,
              color: "rgba(255,255,255,0.55)",
              maxWidth: 800,
            }}
          >
            Open-source agent messaging on Base Sepolia · XMTP · Groq
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
