import { ImageResponse } from "next/og";
import { SITE, LOGO } from "@/lib/miniapp";

export const runtime = "edge";

/** Per-note embed/OG card — 3:2 (1200x800) for the in-feed Mini App card. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body = "";
  let who = "a wallet on Base";
  let signed = false;
  try {
    const res = await fetch(`${SITE}/api/notes/${id}`, { cache: "no-store" });
    if (res.ok) {
      const j = await res.json();
      if (j?.ok && j.note) {
        body = String(j.note.body ?? "").slice(0, 240);
        const addr = String(j.note.address ?? "");
        who = j.note.username
          ? `@${j.note.username}`
          : addr
            ? `${addr.slice(0, 6)}…${addr.slice(-4)}`
            : who;
        signed = !!j.note.signature;
      }
    }
  } catch {
    // defaults
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
            "radial-gradient(ellipse 70% 55% at 90% -15%, rgba(91,141,239,0.28), transparent 60%), radial-gradient(ellipse 60% 50% at -5% 115%, rgba(139,92,246,0.24), transparent 60%)",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} width={56} height={56} style={{ borderRadius: 999 }} alt="" />
            <div style={{ color: "#fff", fontSize: 28, fontWeight: 700 }}>SIGNA</div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: signed ? "#5b8def" : "#666",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: 2,
              border: `1px solid ${signed ? "rgba(91,141,239,0.5)" : "#333"}`,
              borderRadius: 999,
              padding: "10px 22px",
            }}
          >
            {signed ? "✓ SIGNED ON BASE" : "UNSIGNED"}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            color: "#ffffff",
            fontSize: 60,
            fontWeight: 700,
            lineHeight: 1.18,
            letterSpacing: -1,
            borderLeft: "5px solid #5b8def",
            paddingLeft: 32,
            maxHeight: 360,
            overflow: "hidden",
          }}
        >
          {body ? `“${body}”` : "(note not found)"}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#8a8aa0",
            fontSize: 28,
          }}
        >
          <div style={{ display: "flex", color: "#a5c3ff" }}>— {who}</div>
          <div style={{ display: "flex" }}>re-verify at signaagent.xyz</div>
        </div>
      </div>
    ),
    { width: 1200, height: 800 },
  );
}
