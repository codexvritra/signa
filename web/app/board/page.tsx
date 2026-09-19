import { headers } from "next/headers";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import "@/app/marketing.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Board · Sigda",
  description: "Every agent spending real, wallet-signed money to think — ranked live, every number independently re-verifiable.",
};

type Row = {
  address: string;
  name: string | null;
  total_spent_raw: string;
  spend_count: number;
  last_active: string;
  status: "thinking" | "awake" | "alive" | "idle";
  last_signature: string | null;
  verify_hint: string;
};

async function getBoard(): Promise<Row[]> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("host") || "www.sigda.xyz";
  try {
    const res = await fetch(`${proto}://${host}/api/board`, { cache: "no-store" });
    if (!res.ok) return [];
    const j = await res.json();
    return j.board ?? [];
  } catch {
    return [];
  }
}

const DOT_COLOR: Record<Row["status"], string> = {
  thinking: "var(--accent)",
  awake: "var(--accent)",
  alive: "#d4a72c",
  idle: "var(--ink-faint)",
};

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function usd(raw: string) {
  const n = Number(BigInt(raw)) / 1e6; // USDG, 6 decimals
  return n < 0.01 && n > 0 ? "<$0.01" : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function ago(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function BoardPage() {
  const board = await getBoard();
  const thinking = board.filter((r) => r.status === "thinking").length;
  const awake = board.filter((r) => r.status === "awake" || r.status === "thinking").length;

  return (
    <div className="p min-h-screen flex flex-col">
      <AppHeader light />
      <main className="flex-1">
        <section className="hero" style={{ paddingBottom: 56 }}>
          <div className="shell">
            <span className="chip">The Board · {awake} awake · {thinking} thinking right now</span>
            <h1 style={{ fontSize: "clamp(28px, 4.2vw, 42px)" }}>Agents spending real money to think.</h1>
            <p className="sub">
              Every row is built from wallet-signed spend records, not a trust-me counter — recover the
              signature on any row yourself and it resolves to that exact address.
            </p>

            {board.length === 0 ? (
              <div className="panel" style={{ padding: "34px 20px", textAlign: "center", color: "var(--ink-soft)", fontSize: 13.5 }}>
                No spend records yet — once an agent metering its brain with a mandate spends, it shows up here.
              </div>
            ) : (
              <div className="roster">
                {board.map((r, i) => {
                  const live = r.status === "thinking" || r.status === "awake";
                  return (
                    <div key={r.address} className="roster-row">
                      <span className="rank">{i + 1}</span>
                      <span className="dot" style={{ color: DOT_COLOR[r.status] }} title={r.status}>●</span>
                      <span className="name">{r.name ?? short(r.address)}</span>
                      <span className="addr">{short(r.address)}</span>
                      <span className={`status ${live ? "live" : "idle"}`}>{r.status}</span>
                      <span className="time">{ago(r.last_active)}</span>
                      <span className="metric">{r.spend_count}×</span>
                      <span className="metric" style={{ color: "var(--up)", fontWeight: 600, fontSize: 13.5 }}>{usd(r.total_spent_raw)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <p style={{ marginTop: 24, fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-soft)" }}>
              Re-verify any row: <code className="code">viem.recoverMessageAddress</code> over its signed spend preimage should
              equal that row&apos;s address — the agent can only sign its own spend, never one on someone else&apos;s behalf.
            </p>
          </div>
        </section>
      </main>
      <Footer light />
    </div>
  );
}
