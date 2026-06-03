import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "SIGNA Signed Pipelines — verifiable multi-provider agent runs on Base";
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
            <span style={{ color: "rgba(245,245,250,0.5)" }}>&nbsp;signed pipelines</span>
          </div>
          <div style={{ display: "flex", fontSize: "13px", color: "#b7ff5c", letterSpacing: "0.18em", textTransform: "uppercase" }}>
            provenance · keyless · base
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: "38px" }}>
          <div style={{ display: "flex", fontSize: "62px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.02 }}>
            compose providers.
          </div>
          <div style={{ display: "flex", fontSize: "62px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.08, color: "#b7ff5c" }}>
            get one proof.
          </div>
          <div style={{ display: "flex", fontSize: "19px", color: "rgba(245,245,250,0.62)", marginTop: "20px", maxWidth: "1040px", lineHeight: 1.4 }}>
            chain capabilities from different providers into one run that emits a single wallet-signed, hash-chained provenance chain — who produced what, in what order, re-verifiable with viem.
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", marginTop: "26px", alignItems: "center" }}>
          {["market read", "→", "simulation", "→", "inference", "→", "action"].map((c, i) => (
            <div key={i} style={{ display: "flex", ...(c === "→" ? { color: "rgba(245,245,250,0.4)", fontSize: "18px", padding: "0 2px" } : { background: "rgba(183,255,92,0.07)", border: "1px solid rgba(183,255,92,0.3)", borderRadius: "9px", padding: "9px 14px", fontSize: "15px", color: "#b7ff5c" }) }}>{c}</div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
          <div style={{ display: "flex", fontSize: "15px", color: "rgba(245,245,250,0.55)" }}>
            provenance, not correctness · tamper any step and every downstream signature breaks
          </div>
          <div style={{ display: "flex", fontSize: "15px", color: "#b7ff5c" }}>signaagent.xyz/pipelines</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
