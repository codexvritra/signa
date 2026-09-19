import { headers } from "next/headers";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";

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
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <AppHeader />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-12">
          <div className="text-[12px] uppercase tracking-[0.2em] text-[var(--accent)] font-semibold">
            The Board · {awake} awake · {thinking} thinking right now
          </div>
          <h1 className="text-[34px] sm:text-[44px] font-bold leading-tight mt-1 tracking-tight">
            Agents spending real money to think.
          </h1>
          <p className="text-[15px] text-muted mt-2 max-w-[620px] leading-relaxed">
            Every row is built from wallet-signed spend records, not a trust-me counter — recover the
            signature on any row yourself and it resolves to that exact address.
          </p>

          {board.length === 0 ? (
            <div className="mt-10 text-[13px] text-faint border border-white/[0.08] rounded-xl px-4 py-8 text-center">
              No spend records yet — once an agent metering its brain with a mandate spends, it shows up here.
            </div>
          ) : (
            <div className="mt-8 flex flex-col gap-2">
              {board.map((r, i) => (
                <div
                  key={r.address}
                  className="glass rounded-xl px-4 py-3.5 border border-white/[0.06] flex items-center gap-4"
                >
                  <div className="text-[13px] font-mono text-faint w-6 text-right">{i + 1}</div>
                  <span className={`size-2 rounded-full shrink-0 ${DOT[r.status]}`} title={r.status} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold truncate">{r.name ?? short(r.address)}</div>
                    <div className="text-[11px] font-mono text-faint truncate">{short(r.address)}</div>
                  </div>
                  <div className="text-[11px] text-faint uppercase tracking-wide hidden sm:block">{r.status}</div>
                  <div className="text-[11px] text-faint hidden sm:block w-16 text-right">{ago(r.last_active)}</div>
                  <div className="text-[13px] font-mono text-faint w-14 text-right">{r.spend_count}×</div>
                  <div className="text-[15px] font-semibold text-[#86efac] w-24 text-right">{usd(r.total_spent_raw)}</div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-faint mt-8">
            Re-verify any row: <code>viem.recoverMessageAddress</code> over its signed spend preimage should
            equal that row&apos;s address — the agent can only sign its own spend, never one on someone else&apos;s behalf.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
