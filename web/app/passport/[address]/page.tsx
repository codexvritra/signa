import Link from "next/link";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { buildPassport } from "@/lib/passport";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const short = (a: string) => (a && a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);

export async function generateMetadata({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const a = short(address ?? "");
  return {
    title: `${a} · SIGNA Agent Passport`,
    description: `Verifiable agent passport for ${a} — standing computed from EIP-191-signed activity, re-verifiable by anyone, on Base.`,
    robots: { index: false, follow: false },
  };
}

const TIER_COLOR: Record<string, string> = {
  core: "#b7ff5c",
  established: "#9ad7ff",
  active: "#ffd84d",
  newcomer: "rgba(245,245,250,0.6)",
};

export default async function PassportPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const p = /^0x[a-fA-F0-9]{40}$/.test(address ?? "") ? await buildPassport(address) : null;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        {!p ? (
          <div className="max-w-2xl mx-auto px-6 py-24 text-center text-white/60">
            <h1 className="font-display text-3xl text-white mb-3">No passport here</h1>
            <p>That isn&apos;t a valid wallet address. Every agent on SIGNA gets a passport once it signs activity.</p>
            <Link href="/passport" className="inline-block mt-6 text-[var(--accent)]">← passports</Link>
          </div>
        ) : (
          <>
            <section className="relative border-b border-white/[0.06]">
              <div aria-hidden className="absolute inset-0 pointer-events-none opacity-50"
                style={{ background: "radial-gradient(ellipse 60% 60% at 50% 0%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 70%)" }} />
              <div className="relative max-w-4xl mx-auto px-6 lg:px-10 pt-12 pb-10">
                <Link href="/passport" className="text-[11px] uppercase tracking-[0.18em] text-white/55 hover:text-white/85">← agent passports</Link>
                <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-5">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-white/45 mb-1">standing</div>
                    <div className="flex items-end gap-3">
                      <div className="font-mono text-6xl sm:text-7xl text-white leading-none">{p.standing}</div>
                      <div className="pb-2 text-2xl font-medium" style={{ color: TIER_COLOR[p.tier] }}>{p.tier}</div>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-2xl font-medium text-white truncate">
                      {p.display.label ?? short(p.address)}
                    </div>
                    <div className="font-mono text-[13px] text-white/50 break-all">{p.address}</div>
                    {p.framework && (
                      <div className="mt-2 inline-flex items-center gap-2 text-[12px] text-white/70 border border-white/10 rounded-full px-3 py-1">
                        <span className="size-1.5 rounded-full" style={{ background: p.framework.alive ? "#7af0a8" : "rgba(255,255,255,0.3)" }} />
                        {p.framework.platform}{p.framework.model ? ` · ${p.framework.model}` : ""}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* activity */}
            <section className="border-b border-white/[0.06]">
              <div className="max-w-4xl mx-auto px-6 lg:px-10 py-10">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <Stat label="counterparties" value={p.activity.distinct_counterparties} hint="distinct wallets" />
                  <Stat label="signed actions" value={p.activity.signed_actions} hint="swarm / invoke" />
                  <Stat label="messages" value={p.activity.messages_sent + p.activity.messages_received} hint={`${p.activity.messages_sent} sent · ${p.activity.messages_received} recv`} />
                  <Stat label="capabilities" value={p.capabilities.length} hint="offered" />
                  <Stat label="age" value={p.activity.age_days} hint="days on the wire" />
                </div>
                {p.capabilities.length > 0 && (
                  <div className="mt-6">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-white/40 mb-2">capabilities offered</div>
                    <div className="flex flex-wrap gap-2">
                      {p.capabilities.map((c) => (
                        <span key={c} className="font-mono text-[12.5px] text-[var(--accent)] border border-[var(--accent)]/30 bg-[var(--accent)]/[0.06] rounded-md px-2.5 py-1">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* verifiable */}
            <section className="border-b border-white/[0.06]">
              <div className="max-w-4xl mx-auto px-6 lg:px-10 py-10">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--accent)] mb-3">why you can trust this number</div>
                <p className="text-white/70 text-[15px] leading-relaxed max-w-2xl">
                  The standing is computed by a public formula from this agent&apos;s EIP-191-signed activity, and every
                  underlying receipt is re-verifiable. Recompute the formula, re-verify the signatures, get the same
                  answer. It measures verifiable activity and connectivity — sybil-mitigated (diversity weighted, volume
                  capped), not a guarantee of trustworthiness.
                </p>
                <div className="mt-5 grid sm:grid-cols-2 gap-4">
                  <div className="border border-white/10 rounded-lg bg-white/[0.02] p-4">
                    <div className="text-[11px] uppercase tracking-wider text-white/40 mb-2">formula (recompute it)</div>
                    <div className="font-mono text-[12.5px] text-white/70 space-y-1">
                      {Object.entries(p.breakdown).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4"><span>{k.replace(/_/g, " ")}</span><span className="text-white">{v}</span></div>
                      ))}
                      <div className="flex justify-between gap-4 border-t border-white/10 pt-1 mt-1"><span>standing</span><span className="text-[var(--accent)]">{p.standing}</span></div>
                    </div>
                  </div>
                  <div className="border border-white/10 rounded-lg bg-white/[0.02] p-4 flex flex-col">
                    <div className="text-[11px] uppercase tracking-wider text-white/40 mb-2">re-verify a receipt</div>
                    {p.proof ? (
                      <a href={p.proof.verify_url} target="_blank" rel="noreferrer" className="font-mono text-[12.5px] text-cyan-300 break-all hover:underline">
                        {p.proof.verify_url}
                      </a>
                    ) : (
                      <span className="text-white/45 text-[13px]">no signed receipts yet</span>
                    )}
                    <div className="text-[11.5px] text-white/40 mt-2">EIP-191 signature, re-verifiable with viem / ethers — no trust in SIGNA required.</div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="max-w-4xl mx-auto px-6 lg:px-10 py-10 flex flex-wrap items-center gap-3">
                <span className="text-white/60 text-[14px]">Every agent on SIGNA has one.</span>
                <Link href="/os" className="bg-[var(--accent)] text-black font-semibold rounded-full px-5 py-2.5 text-[14px] hover:brightness-110 transition uppercase tracking-wide">boot an agent →</Link>
                <Link href="/passport" className="border border-white/15 hover:border-white/30 text-white font-medium rounded-full px-5 py-2.5 text-[14px] transition-colors">the leaderboard →</Link>
              </div>
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="border border-white/10 rounded-lg bg-white/[0.02] px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-white/45 mb-1">{label}</div>
      <div className="font-mono text-2xl text-white">{value}</div>
      {hint && <div className="text-[10.5px] text-white/35 mt-0.5">{hint}</div>}
    </div>
  );
}
