import { ImageResponse } from "next/og";
import { LOGO } from "@/lib/miniapp";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/** Home Mini App embed card — 3:2 (1200x800) as the spec mandates for imageUrl. */
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0f",
          backgroundImage:
            "radial-gradient(ellipse 70% 55% at 85% -10%, rgba(91,141,239,0.30), transparent 60%), radial-gradient(ellipse 60% 50% at 0% 110%, rgba(139,92,246,0.26), transparent 60%)",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} width={68} height={68} style={{ borderRadius: 999 }} alt="" />
          <div style={{ color: "#fff", fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>
            SIGNA
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              color: "#ffffff",
              fontSize: 86,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -2,
              maxWidth: 980,
            }}
          >
            Sign a message on Base.
          </div>
          <div style={{ color: "#a5c3ff", fontSize: 38, fontWeight: 500 }}>
            One tap. No account. Your wallet signature is the proof.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#8a8aa0",
            fontSize: 26,
          }}
        >
          <div style={{ display: "flex", gap: 16 }}>
            <span style={{ color: "#5b8def" }}>wallet-signed</span>
            <span>·</span>
            <span style={{ color: "#8b5cf6" }}>re-verifiable</span>
            <span>·</span>
            <span>on Base</span>
          </div>
          <div>signaagent.xyz</div>
        </div>
      </div>
    ),
    { width: 1200, height: 800 },
  );
}
