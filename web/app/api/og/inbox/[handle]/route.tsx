import { ImageResponse } from "next/og";
import { sanitizeTo } from "@/lib/note";
import { LOGO } from "@/lib/miniapp";

export const runtime = "edge";

/** Personal inbox embed/OG card — 3:2 (1200x800). "send @handle a signed message". */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle: raw } = await params;
  const handle = sanitizeTo(decodeURIComponent(raw)) ?? "someone";
  const display = handle.startsWith("0x") ? `${handle.slice(0, 6)}…${handle.slice(-4)}` : `@${handle}`;

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
            "radial-gradient(ellipse 70% 55% at 85% -10%, rgba(91,141,239,0.30), transparent 60%), radial-gradient(ellipse 60% 50% at 0% 110%, rgba(139,92,246,0.26), transparent 60%)",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} width={60} height={60} style={{ borderRadius: 999 }} alt="" />
          <div style={{ color: "#fff", fontSize: 30, fontWeight: 700 }}>SIGNA</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ color: "#a5c3ff", fontSize: 36, fontWeight: 500 }}>
            send {display} a
          </div>
          <div
            style={{
              color: "#ffffff",
              fontSize: 92,
              fontWeight: 800,
              lineHeight: 1.0,
              letterSpacing: -2,
            }}
          >
            wallet-signed message
          </div>
          <div style={{ color: "#8a8aa0", fontSize: 32 }}>on Base · one tap · no account</div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#8a8aa0",
            fontSize: 26,
          }}
        >
          <div style={{ color: "#5b8def" }}>signed, not spoofed</div>
          <div>signaagent.xyz</div>
        </div>
      </div>
    ),
    { width: 1200, height: 800 },
  );
}
