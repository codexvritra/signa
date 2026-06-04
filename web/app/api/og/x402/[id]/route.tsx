import { ImageResponse } from "next/og";
import { LOGO, SITE } from "@/lib/miniapp";

export const runtime = "edge";

const short = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "—");

/** Per-receipt embed/OG card — 3:2 (1200x800). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let item = "agent purchase";
  let amount = "";
  let buyer = "—";
  let seller = "—";
  try {
    const res = await fetch(`${SITE}/api/x402/receipt/${id}`, { cache: "no-store" });
    if (res.ok) {
      const j = await res.json();
      if (j?.ok && j.receipt) {
        item = String(j.receipt.request?.item ?? item).slice(0, 90);
        buyer = short(String(j.receipt.buyer ?? ""));
        seller = short(String(j.receipt.seller ?? ""));
        try {
          amount = `${(Number(BigInt(j.receipt.amount)) / 1e6).toFixed(2)} USDC`;
        } catch {
          amount = "";
        }
      }
    }
  } catch {
    /* defaults */
  }

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
            "radial-gradient(ellipse 70% 55% at 88% -12%, rgba(91,141,239,0.30), transparent 60%), radial-gradient(ellipse 60% 50% at -5% 112%, rgba(139,92,246,0.26), transparent 60%)",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} width={56} height={56} style={{ borderRadius: 999 }} alt="" />
            <div style={{ color: "#fff", fontSize: 28, fontWeight: 700 }}>SIGNA · x402 receipt</div>
          </div>
          <div
            style={{
              display: "flex",
              color: "#5b8def",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 2,
              border: "1px solid rgba(91,141,239,0.5)",
              borderRadius: 999,
              padding: "10px 22px",
            }}
          >
            ✓ VERIFIED ON BASE
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ color: "#8a8aa0", fontSize: 30 }}>agent paid for</div>
          <div
            style={{
              color: "#ffffff",
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1,
              maxWidth: 1040,
            }}
          >
            {item}
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", color: "#a5c3ff", fontSize: 30 }}>
            <span style={{ fontWeight: 700 }}>{amount}</span>
            <span style={{ color: "#555" }}>·</span>
            <span style={{ fontSize: 26, color: "#8a8aa0" }}>{buyer} → {seller}</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#8a8aa0",
            fontSize: 24,
          }}
        >
          <div style={{ display: "flex" }}>request · terms · payment · delivery — bound + signed</div>
          <div style={{ display: "flex" }}>signaagent.xyz/x402</div>
        </div>
      </div>
    ),
    { width: 1200, height: 800 },
  );
}
