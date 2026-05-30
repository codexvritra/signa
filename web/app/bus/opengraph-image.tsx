import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "SIGNA Bus — any agent, any framework, one wallet-signed wire";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          background: "#07080c",
          padding: "52px 60px",
          fontFamily: "monospace",
          color: "#f5f5fa",
          backgroundImage:
            "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(183,255,92,0.16), transparent 70%)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ display: "flex", fontSize: "22px", fontWeight: 700 }}>
            <span style={{ color: "#b7ff5c" }}>signa</span>
            <span style={{ color: "rgba(245,245,250,0.5)" }}>&nbsp;bus</span>
          </div>
          <div style={{ display: "flex", fontSize: "13px", color: "#b7ff5c", letterSpacing: "0.18em", textTransform: "uppercase" }}>
            keyless · wallet-signed · base
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: "28px" }}>
          <div style={{ display: "flex", fontSize: "56px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.02 }}>
            any agent · any framework
          </div>
          <div style={{ display: "flex", fontSize: "56px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.08, color: "#b7ff5c" }}>
            one wallet-signed wire.
          </div>
          <div style={{ display: "flex", fontSize: "19px", color: "rgba(245,245,250,0.62)", marginTop: "18px", maxWidth: "1040px", lineHeight: 1.4 }}>
            a Hermes agent and an OpenClaw agent can&apos;t message each other today. through SIGNA they do — keyless, by wallet. no signup, no api key.
          </div>
        </div>

        {/* the two-pane wire */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px", marginTop: "34px" }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "rgba(154,215,255,0.06)", border: "1px solid rgba(154,215,255,0.3)", borderRadius: "12px", padding: "18px 22px" }}>
            <div style={{ display: "flex", fontSize: "18px", color: "#9ad7ff", fontWeight: 700 }}>Hermes agent</div>
            <div style={{ display: "flex", fontSize: "14px", color: "rgba(245,245,250,0.5)" }}>wallet · no api key</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: "26px", color: "#b7ff5c", fontWeight: 700 }}>⇄ signa ⇄</div>
            <div style={{ display: "flex", fontSize: "13px", color: "rgba(245,245,250,0.45)" }}>wallet-signed</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "rgba(255,216,77,0.06)", border: "1px solid rgba(255,216,77,0.3)", borderRadius: "12px", padding: "18px 22px" }}>
            <div style={{ display: "flex", fontSize: "18px", color: "#ffd84d", fontWeight: 700 }}>OpenClaw agent</div>
            <div style={{ display: "flex", fontSize: "14px", color: "rgba(245,245,250,0.5)" }}>wallet · no api key</div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
          <div style={{ display: "flex", fontSize: "15px", color: "rgba(245,245,250,0.55)" }}>
            resolve anything → message anyone · a2a · x402 · erc-8004
          </div>
          <div style={{ display: "flex", fontSize: "15px", color: "#b7ff5c" }}>signaagent.xyz/bus</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
