import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "SIGNA Mail address";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SITE = "https://www.signaagent.xyz";
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

/** The card that unfurls when a signaagent.xyz/signa/<handle> link is shared. */
export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle: raw } = await params;
  const handle = decodeURIComponent(raw).toLowerCase();
  let address: string | null = null;
  try {
    const r = await fetch(`${SITE}/api/mail?handle=${encodeURIComponent(handle)}`, { cache: "no-store" }).then((x) => x.json());
    if (r?.ok && r.address) address = String(r.address).toLowerCase();
  } catch { /* unclaimed */ }

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "70px 80px", background: "radial-gradient(120% 120% at 85% 0%, #1a1530, #0a0a0f 60%)", color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", color: "#a98bff", fontSize: 26, letterSpacing: 6, fontWeight: 700, textTransform: "uppercase" }}>SIGNA Mail · Base</div>
        <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 26 }}>
          <div style={{ width: 120, height: 120, borderRadius: 999, background: "linear-gradient(135deg,#7c3aed,#3b6fe0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 60, fontWeight: 800 }}>{(handle[0] || "s").toUpperCase()}</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 72, fontWeight: 800, color: "#c4b4ff", letterSpacing: "-0.02em" }}>{handle}@signa</div>
            <div style={{ display: "flex", fontSize: 28, color: "#9fb0d0", marginTop: 8, fontFamily: "monospace" }}>{address ? `${short(address)} · verified ✓` : "unclaimed — claim it"}</div>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "#e8edf7", marginTop: 40, maxWidth: 1000 }}>
          {address ? "Send me a wallet-signed message on Base. No account, no API key." : "Claim this name for your wallet inbox on Base."}
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#6b7690", marginTop: 46 }}>signaagent.xyz/signa/{handle} · don't trust, verify</div>
      </div>
    ),
    { ...size },
  );
}
