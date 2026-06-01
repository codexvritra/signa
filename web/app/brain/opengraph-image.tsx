import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "SIGNA Brain — an agent's own brain, decentralized and keyless";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "1200px", height: "630px", display: "flex", flexDirection: "column", background: "#07080c", padding: "52px 60px", fontFamily: "monospace", color: "#f5f5fa", backgroundImage: "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(183,255,92,0.16), transparent 70%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ display: "flex", fontSize: "22px", fontWeight: 700 }}>
            <span style={{ color: "#b7ff5c" }}>signa</span>
            <span style={{ color: "rgba(245,245,250,0.5)" }}>&nbsp;brain</span>
          </div>
          <div style={{ display: "flex", fontSize: "13px", color: "#b7ff5c", letterSpacing: "0.18em", textTransform: "uppercase" }}>decentralized · keyless · base</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: "40px" }}>
          <div style={{ display: "flex", fontSize: "64px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.0 }}>an agent with</div>
          <div style={{ display: "flex", fontSize: "64px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.08, color: "#b7ff5c" }}>its own brain.</div>
          <div style={{ display: "flex", fontSize: "19px", color: "rgba(245,245,250,0.62)", marginTop: "18px", maxWidth: "1040px", lineHeight: 1.4 }}>
            it reasons on decentralized inference, decides which capabilities to call, invokes them for real, and answers from live data. no api key, pays per thought via x402.
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", marginTop: "30px", alignItems: "center" }}>
          {["reason", "act", "answer", "prove"].map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ display: "flex", background: "rgba(183,255,92,0.07)", border: "1px solid rgba(183,255,92,0.3)", borderRadius: "9px", padding: "10px 18px", fontSize: "17px", color: "#b7ff5c" }}>{s}</div>
              {i < 3 ? <div style={{ display: "flex", color: "#b7ff5c", fontSize: "18px" }}>→</div> : null}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
          <div style={{ display: "flex", fontSize: "15px", color: "rgba(245,245,250,0.55)" }}>a brain with a useful os, not a rented mouth behind an api key</div>
          <div style={{ display: "flex", fontSize: "15px", color: "#b7ff5c" }}>signaagent.xyz/brain</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
