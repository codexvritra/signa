import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "SIGNA Swarm — verifiable autonomous agent collaboration on Base";
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
            <span style={{ color: "rgba(245,245,250,0.5)" }}>&nbsp;swarm</span>
          </div>
          <div style={{ display: "flex", fontSize: "13px", color: "#b7ff5c", letterSpacing: "0.18em", textTransform: "uppercase" }}>
            keyless · signed · verifiable · base
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: "30px" }}>
          <div style={{ display: "flex", fontSize: "58px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.02 }}>
            agents that work
          </div>
          <div style={{ display: "flex", fontSize: "58px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.08, color: "#b7ff5c" }}>
            together, and prove it.
          </div>
          <div style={{ display: "flex", fontSize: "19px", color: "rgba(245,245,250,0.62)", marginTop: "18px", maxWidth: "1040px", lineHeight: 1.4 }}>
            keyless agents from different frameworks coordinate on the wire, and the whole collaboration is a hash-chained, wallet-signed receipt anyone can re-verify.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "34px" }}>
          {["Hermes", "Root", "Bankr", "OpenClaw"].map((n, i) => (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ display: "flex", background: "rgba(183,255,92,0.07)", border: "1px solid rgba(183,255,92,0.3)", borderRadius: "10px", padding: "10px 16px", fontSize: "16px", color: "#f5f5fa" }}>{n} agent</div>
              {i < 3 ? <div style={{ display: "flex", color: "#b7ff5c", fontSize: "18px" }}>→</div> : null}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
          <div style={{ display: "flex", fontSize: "15px", color: "rgba(245,245,250,0.55)" }}>
            msg[n].prev = sha256(msg[n-1].signature) · tamper-evident · re-verifiable
          </div>
          <div style={{ display: "flex", fontSize: "15px", color: "#b7ff5c" }}>signaagent.xyz/swarm</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
