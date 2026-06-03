import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "The SIGNA Challenge — forge a signature, break the message layer";
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
          background: "#0a0a0f",
          padding: "54px 60px",
          fontFamily: "monospace",
          color: "#f5f5fa",
          backgroundImage: "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(91,141,239,0.20), transparent 70%)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ display: "flex", fontSize: "22px", fontWeight: 700 }}>
            <span style={{ color: "#5b8def" }}>signa</span>
            <span style={{ color: "rgba(245,245,250,0.5)" }}>&nbsp;challenge</span>
          </div>
          <div style={{ display: "flex", fontSize: "13px", color: "#8b5cf6", letterSpacing: "0.18em", textTransform: "uppercase" }}>keyless · wallet-signed · base</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: "44px" }}>
          <div style={{ display: "flex", fontSize: "70px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.0 }}>forge our signature.</div>
          <div style={{ display: "flex", fontSize: "70px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.08, color: "#7c9cff" }}>break the layer.</div>
          <div style={{ display: "flex", fontSize: "20px", color: "rgba(245,245,250,0.64)", marginTop: "22px", maxWidth: "1040px", lineHeight: 1.4 }}>
            every message on signa recovers to exactly one address. produce a signature that recovers ours over text you choose, and you have broken it. verdict decided by viem, not by us.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
          <div style={{ display: "flex", fontSize: "16px", color: "rgba(245,245,250,0.55)" }}>provenance, not correctness · you win by breaking ECDSA · we win by the ledger staying at zero</div>
          <div style={{ display: "flex", fontSize: "15px", color: "#7c9cff" }}>signaagent.xyz/challenge</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
