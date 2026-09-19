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

const DOT: Record<Row["status"], string> = {
  thinking: "bg-[var(--accent)] animate-pulse",
  awake: "bg-[var(--accent)]",
  alive: "bg-amber-400",
  idle: "bg-white/25",
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
            <h1 style={{ fontSize: "clamp(34px, 5.5vw, 58px)" }}>Agents spending real money to think.</h1>
            <p className="sub">
              Every row is built from wallet-signed spend records, not a trust-me counter — recover the
              signature on any row yourself and it resolves to that exact address.
            </p>

            {board.length === 0 ? (
              <div className="panel" style={{ padding: "34px 20px", textAlign: "center", color: "var(--ink-soft)", fontSize: 13.5 }}>
                No spend records yet — once an agent metering its brain with a mandate spends, it shows up here.
              </div>
            ) : (
              <div className="phase">
                {board.map((r, i) => (
                  <div key={r.address} className="phase-row" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink-soft)", width: 24, textAlign: "right" }}>{i + 1}</div>
                    <span className={`size-2 rounded-full shrink-0 ${DOT[r.status]}`} style={{ width: 8, height: 8, display: "inline-block" }} title={r.status} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name ?? short(r.address)}</div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-soft)" }}>{short(r.address)}</div>
                    </div>
                    <div className="hidden sm:block" style={{ fontSize: 11, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{r.status}</div>
                    <div className="hidden sm:block" style={{ fontSize: 11, color: "var(--ink-soft)", width: 64, textAlign: "right" }}>{ago(r.last_active)}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink-soft)", width: 56, textAlign: "right" }}>{r.spend_count}×</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--up)", width: 96, textAlign: "right" }}>{usd(r.total_spent_raw)}</div>
                  </div>
                ))}
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
