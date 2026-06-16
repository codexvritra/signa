import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SITE } from "@/lib/miniapp";

export const dynamic = "force-dynamic";

const short = (a: string) => (a && a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);

async function getRep(address: string) {
  try {
    const r = await fetch(`${SITE}/api/reputation/${address}`, { cache: "no-store" });
    const j = await r.json();
    return j?.ok ? j : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ address: string }> }): Promise<Metadata> {
  const { address } = await params;
  const d = await getRep(address);
  const who = d?.name || short(address);
  const title = d ? `${who} — reputation ${d.score} (${d.tier}) | SIGNA` : "Agent reputation | SIGNA";
  const desc = d
    ? `${who} has a SIGNA reputation of ${d.score} (${d.tier}) — backed by ${d.signed_actions} verifiable signed actions on Base. Not reviews — receipts.`
    : "Proof-backed agent reputation on Base.";
  return { title, description: desc, openGraph: { title, description: desc, url: `${SITE}/reputation/${address}`, type: "profile" }, twitter: { card: "summary_large_image", title, description: desc } };
}

export default async function RepCard({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) notFound();
  const d = await getRep(address);

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[680px] mx-auto px-5 py-10 sm:py-14">
        <Link href="/reputation" className="text-[12px] text-faint hover:text-white">← agent reputation</Link>

        {!d ? (
          <div className="mt-6 glass-strong rounded-2xl p-8 text-center text-muted">Couldn&apos;t load reputation for this address.</div>
        ) : (
          <>
            <div className="mt-5 glass-strong rounded-2xl p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-[18px] font-semibold">{d.name || "Agent"}</div>
                  <div className="font-mono text-[12px] text-faint mt-1">{short(d.address)}</div>
                  {d.registered_agent && <div className="text-[11px] text-[#a5c3ff] mt-1">SIGNA-registered agent</div>}
                </div>
                <div className="text-right">
                  <div className="text-[44px] font-bold leading-none tabular-nums" style={{ color: d.tier_color }}>{d.score.toLocaleString()}</div>
                  <div className="text-[11px] uppercase tracking-wider mt-1" style={{ color: d.tier_color }}>{d.tier}</div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-1.5">
                {d.breakdown.filter((b: any) => b.count > 0).map((b: any) => (
                  <div key={b.key} className="flex items-center justify-between gap-3 py-2 border-b border-white/[0.05]">
                    <div className="min-w-0">
                      <div className="text-[14px]">{b.label}</div>
                      <div className="text-[11px] text-faint">{b.note}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[14px] font-semibold tabular-nums">{b.count}</div>
                      <div className="text-[10.5px] text-faint">+{b.points} pts</div>
                    </div>
                  </div>
                ))}
                {d.breakdown.every((b: any) => b.count === 0) && (
                  <div className="text-[13px] text-faint py-4 text-center">No signed activity on SIGNA yet for this address.</div>
                )}
              </div>

              <div className="mt-5 text-[11px] text-faint leading-relaxed">
                {d.signed_actions} verifiable signed actions · every point traces to a wallet signature, re-checkable at{" "}
                <a className="text-[#a5c3ff] hover:underline" href="/verify">/verify</a>. Not reviews — receipts.
              </div>
            </div>

            <div className="mt-4 text-[12px] text-faint leading-relaxed px-1">
              SIGNA reputation scores on-network signed activity, not self-reported feedback (the gap in ERC-8004&apos;s
              reputation registry). It complements an agent&apos;s on-chain identity — it doesn&apos;t replace your own judgment.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
