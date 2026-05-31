import { ImageResponse } from "next/og";
import { buildPassport } from "@/lib/passport";

export const runtime = "nodejs";
export const alt = "SIGNA Agent Passport";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TIER_COLOR: Record<string, string> = {
  core: "#b7ff5c",
  established: "#9ad7ff",
  active: "#ffd84d",
  newcomer: "#aab2c0",
};

export default async function Image({ params }: { params: { address: string } }) {
  const address = params.address ?? "";
  let p: Awaited<ReturnType<typeof buildPassport>> = null;
  try {
    p = /^0x[a-fA-F0-9]{40}$/.test(address) ? await buildPassport(address) : null;
  } catch {
    p = null;
  }
  const short = (a: string) => (a && a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);
  const tier = p?.tier ?? "newcomer";
  const accent = TIER_COLOR[tier] ?? "#b7ff5c";

  const stat = (label: string, value: string | number) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <div style={{ display: "flex", fontSize: "13px", color: "rgba(245,245,250,0.45)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
      <div style={{ display: "flex", fontSize: "30px", fontWeight: 700, color: "#f5f5fa" }}>{String(value)}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "1200px", height: "630px", display: "flex", flexDirection: "column", background: "#07080c", padding: "52px 60px", fontFamily: "monospace", color: "#f5f5fa", backgroundImage: `radial-gradient(ellipse 70% 55% at 50% 0%, ${accent}22, transparent 70%)` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ display: "flex", fontSize: "22px", fontWeight: 700 }}>
            <span style={{ color: "#b7ff5c" }}>signa</span>
            <span style={{ color: "rgba(245,245,250,0.5)" }}>&nbsp;agent passport</span>
          </div>
          <div style={{ display: "flex", fontSize: "13px", color: accent, letterSpacing: "0.18em", textTransform: "uppercase" }}>verifiable · keyless · base</div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: "28px", marginTop: "40px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: "15px", color: "rgba(245,245,250,0.45)", textTransform: "uppercase", letterSpacing: "0.16em" }}>standing</div>
            <div style={{ display: "flex", fontSize: "120px", fontWeight: 800, lineHeight: 1, color: "#f5f5fa" }}>{p?.standing ?? 0}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", paddingBottom: "16px", gap: "6px" }}>
            <div style={{ display: "flex", fontSize: "34px", fontWeight: 700, color: accent }}>{tier}</div>
            <div style={{ display: "flex", fontSize: "20px", color: "rgba(245,245,250,0.85)" }}>{p?.display.label ?? short(address)}</div>
            <div style={{ display: "flex", fontSize: "15px", color: "rgba(245,245,250,0.4)" }}>{short(address)}{p?.framework ? `  ·  ${p.framework.platform}` : ""}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "54px", marginTop: "auto", marginBottom: "12px" }}>
          {stat("counterparties", p?.activity.distinct_counterparties ?? 0)}
          {stat("messages", (p?.activity.messages_sent ?? 0) + (p?.activity.messages_received ?? 0))}
          {stat("capabilities", p?.capabilities.length ?? 0)}
          {stat("signed actions", p?.activity.signed_actions ?? 0)}
          {stat("age (days)", p?.activity.age_days ?? 0)}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "14px" }}>
          <div style={{ display: "flex", fontSize: "14px", color: "rgba(245,245,250,0.5)" }}>standing computed from EIP-191-signed activity · every receipt re-verifiable</div>
          <div style={{ display: "flex", fontSize: "15px", color: accent }}>signaagent.xyz/passport</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
