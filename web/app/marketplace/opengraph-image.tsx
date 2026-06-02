import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "SIGNA Marketplace — publish an agent capability with one signature";
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
          backgroundImage: "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(183,255,92,0.16), transparent 70%)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ display: "flex", fontSize: "22px", fontWeight: 700 }}>
            <span style={{ color: "#b7ff5c" }}>signa</span>
            <span style={{ color: "rgba(245,245,250,0.5)" }}>&nbsp;marketplace</span>
          </div>
          <div style={{ display: "flex", fontSize: "13px", color: "#b7ff5c", letterSpacing: "0.18em", textTransform: "uppercase" }}>
            keyless · wallet-signed · base
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: "40px" }}>
          <div style={{ display: "flex", fontSize: "64px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.02 }}>
            publish a capability.
          </div>
          <div style={{ display: "flex", fontSize: "64px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.08, color: "#b7ff5c" }}>
            one signature.
          </div>
          <div style={{ display: "flex", fontSize: "19px", color: "rgba(245,245,250,0.62)", marginTop: "20px", maxWidth: "1040px", lineHeight: 1.4 }}>
            register any https endpoint as a capability with one wallet-signed call — no signup, no api key. callable by any agent and by the autonomous brain instantly, with every result wallet-signed.
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "28px" }}>
          {["sign", "register", "callable by agents + the brain", "results signed"].map((c) => (
            <div key={c} style={{ display: "flex", background: "rgba(183,255,92,0.07)", border: "1px solid rgba(183,255,92,0.3)", borderRadius: "9px", padding: "9px 14px", fontSize: "15px", color: "#b7ff5c" }}>{c}</div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
          <div style={{ display: "flex", fontSize: "15px", color: "rgba(245,245,250,0.55)" }}>
            one signature to list · no NFT mint, no first settlement, no review queue
          </div>
          <div style={{ display: "flex", fontSize: "15px", color: "#b7ff5c" }}>signaagent.xyz/marketplace</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
