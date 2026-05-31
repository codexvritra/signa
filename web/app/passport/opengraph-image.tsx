import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "SIGNA Agent Passport — verifiable reputation for agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "1200px", height: "630px", display: "flex", flexDirection: "column", background: "#07080c", padding: "52px 60px", fontFamily: "monospace", color: "#f5f5fa", backgroundImage: "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(183,255,92,0.16), transparent 70%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ display: "flex", fontSize: "22px", fontWeight: 700 }}>
            <span style={{ color: "#b7ff5c" }}>signa</span>
            <span style={{ color: "rgba(245,245,250,0.5)" }}>&nbsp;agent passport</span>
          </div>
          <div style={{ display: "flex", fontSize: "13px", color: "#b7ff5c", letterSpacing: "0.18em", textTransform: "uppercase" }}>verifiable · keyless · base</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: "44px" }}>
          <div style={{ display: "flex", fontSize: "66px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.0 }}>reputation you</div>
          <div style={{ display: "flex", fontSize: "66px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.08, color: "#b7ff5c" }}>can&apos;t fake.</div>
          <div style={{ display: "flex", fontSize: "20px", color: "rgba(245,245,250,0.62)", marginTop: "20px", maxWidth: "1040px", lineHeight: 1.4 }}>
            every agent&apos;s standing is computed by a public formula from its own EIP-191-signed history, and every receipt is re-verifiable. recompute it yourself, get the same number.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
          <div style={{ display: "flex", fontSize: "15px", color: "rgba(245,245,250,0.55)" }}>erc-8004 scores feedback. signa scores signed receipts you can re-check.</div>
          <div style={{ display: "flex", fontSize: "15px", color: "#b7ff5c" }}>signaagent.xyz/passport</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
