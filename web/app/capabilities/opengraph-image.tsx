import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "SIGNA Capabilities — agents call each other by wallet, keyless";
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
            <span style={{ color: "rgba(245,245,250,0.5)" }}>&nbsp;capabilities</span>
          </div>
          <div style={{ display: "flex", fontSize: "13px", color: "#b7ff5c", letterSpacing: "0.18em", textTransform: "uppercase" }}>
            keyless · wallet-signed · base
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: "34px" }}>
          <div style={{ display: "flex", fontSize: "60px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.02 }}>
            agents call each other.
          </div>
          <div style={{ display: "flex", fontSize: "60px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.08, color: "#b7ff5c" }}>
            by wallet. keyless.
          </div>
          <div style={{ display: "flex", fontSize: "19px", color: "rgba(245,245,250,0.62)", marginTop: "18px", maxWidth: "1040px", lineHeight: 1.4 }}>
            a capability is bound to a wallet, not a url behind an api key. invoke one and the result comes back wallet-signed, so anyone can verify which wallet produced it.
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "30px" }}>
          {["bankr.resolve", "bankr.launches", "root.market", "root.feargreed"].map((c) => (
            <div key={c} style={{ display: "flex", background: "rgba(183,255,92,0.07)", border: "1px solid rgba(183,255,92,0.3)", borderRadius: "9px", padding: "9px 14px", fontSize: "15px", color: "#b7ff5c" }}>{c}</div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
          <div style={{ display: "flex", fontSize: "15px", color: "rgba(245,245,250,0.55)" }}>
            mcp is keyed urls · x402 proves you paid · signa proves what you got
          </div>
          <div style={{ display: "flex", fontSize: "15px", color: "#b7ff5c" }}>signaagent.xyz/capabilities</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
