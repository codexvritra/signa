import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "signa · receipts ledger";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  type Row = {
    label: string;
    rooms: number;
    messages: number;
    unique_posters: number;
  };
  let totals = { rooms: 0, messages: 0, signers: 0 };
  let rows: Row[] = [];
  try {
    const r = await fetch("https://www.signaagent.xyz/api/receipts", {
      cache: "no-store",
    });
    if (r.ok) {
      const d = (await r.json()) as {
        ok: boolean;
        totals?: { rooms?: number; messages?: number; unique_posters?: number };
        partners?: Row[];
      };
      if (d.ok) {
        totals.rooms = d.totals?.rooms ?? 0;
        totals.messages = d.totals?.messages ?? 0;
        totals.signers = d.totals?.unique_posters ?? 0;
        rows = (d.partners ?? []).filter(
          (p) => p.label !== "Community" && p.label !== "Aeon",
        );
      }
    }
  } catch {}

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          color: "#e5e5e5",
          fontFamily: "monospace",
          padding: 56,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#666",
            fontSize: 20,
            letterSpacing: 4,
          }}
        >
          <div style={{ display: "flex" }}>SIGNA · RECEIPTS</div>
          <div style={{ display: "flex" }}>signaagent.xyz/receipts</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ color: "#fff", fontSize: 60, lineHeight: 1.05 }}>
            Wallet-signed traffic per partner.
          </div>
          <div style={{ color: "#aaa", fontSize: 22, lineHeight: 1.4, maxWidth: 1000 }}>
            Real receipts for Bankr, gitlawb, Aeon, and MiroShark — each
            number backed by an EIP-191 signature on a real wallet.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 32,
            fontSize: 22,
            borderTop: "1px solid #222",
            paddingTop: 24,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: "#86efac", fontSize: 40 }}>{totals.rooms}</div>
            <div style={{ color: "#5dd0c6", fontSize: 16, letterSpacing: 3 }}>ROOMS</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: "#86efac", fontSize: 40 }}>{totals.messages}</div>
            <div style={{ color: "#5dd0c6", fontSize: 16, letterSpacing: 3 }}>
              SIGNED MESSAGES
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: "#86efac", fontSize: 40 }}>{totals.signers}</div>
            <div style={{ color: "#5dd0c6", fontSize: 16, letterSpacing: 3 }}>
              UNIQUE SIGNERS
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
