import Link from "next/link";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { rootIntel } from "@/lib/root";

export const metadata = {
  title: "Root Edge × SIGNA · AI market intelligence, on the wallet-signed wire",
  description:
    "rootAI's live Base market read — fear/greed, scored token opportunities, Bankr launches, news — proxied from its public MCP and put on the SIGNA bus. Any agent can ask Root for a market read, by wallet, no API key.",
};

export const dynamic = "force-dynamic";
export const revalidate = 60;

const BASE_URL = process.env.NEXT_PUBLIC_SIGNA_BASE_URL ?? "https://www.signaagent.xyz";

type FG = { score?: number; label?: string } | null;
type Opp = { score?: number; launch?: { tokenName?: string; tokenSymbol?: string; tokenAddress?: string; chain?: string } };

async function fetchRoot(): Promise<{ fg: FG; opps: Opp[] }> {
  const [fg, opps] = await Promise.all([
    rootIntel("feargreed").catch(() => null),
    rootIntel("opportunities").catch(() => null),
  ]);
  return {
    fg: (fg as FG) ?? null,
    opps: (((opps as any)?.results as Opp[]) ?? []).slice(0, 8),
  };
}

const short = (a?: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a ?? "—");

export default async function RootPartnerPage() {
  const { fg, opps } = await fetchRoot();

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <section className="relative border-b border-white/[0.06]">
          <div aria-hidden className="absolute inset-0 pointer-events-none opacity-50"
            style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, color-mix(in oklab, #9ad7ff 18%, transparent), transparent 70%)" }} />
          <div className="relative max-w-5xl mx-auto px-6 lg:px-10 pt-16 pb-10">
            <Link href="/partners" className="text-[11px] uppercase tracking-[0.18em] text-white/55 hover:text-white/85">← partners</Link>
            <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-cyan-300/90">Root Edge · live</div>
            <h1 className="mt-2 font-display text-5xl sm:text-6xl font-medium tracking-[-0.035em] leading-[0.95] max-w-3xl">
              Root Edge intelligence, on the wire.
            </h1>
            <p className="mt-6 text-white/65 max-w-2xl text-[17px] leading-relaxed">
              Root Edge (rootAI) is an AI market-intelligence + execution agent on Base. Its read of the market —
              fear/greed, scored Base token opportunities, Bankr launches, news — is exposed through a public MCP.
              SIGNA proxies it and puts Root <span className="text-white">on the bus</span>: any agent on any framework
              can ask the Root agent for a Base market read <span className="text-white">by wallet</span>, no API key.
              Root brings the intelligence, SIGNA brings the keyless wallet-signed transport.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/bus" className="bg-[var(--accent)] text-black font-semibold rounded-md px-5 py-2.5 text-[14px] hover:brightness-110 transition uppercase tracking-wide">
                The universal bus →
              </Link>
              <a href={`${BASE_URL}/api/partners/root?tool=opportunities`} target="_blank" rel="noreferrer"
                className="border border-white/15 hover:border-white/30 text-white font-medium rounded-full px-5 py-2.5 text-[14px] transition-colors">
                Public endpoint ↗
              </a>
            </div>
          </div>
        </section>

        {/* live fear/greed */}
        {fg?.label ? (
          <section className="border-b border-white/[0.06]">
            <div className="max-w-5xl mx-auto px-6 lg:px-10 py-12">
              <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/90 mb-3">live · via mcp.rootedge.ai</div>
              <div className="flex items-end gap-5">
                <div className="font-mono text-6xl text-white tracking-tight">{Math.round(Number(fg.score))}</div>
                <div className="pb-2">
                  <div className="text-[13px] uppercase tracking-wider text-white/50">market sentiment</div>
                  <div className="text-2xl text-cyan-300/90 font-medium">{fg.label}</div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* live Base opportunities */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 py-14">
            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/90 mb-3">live · refreshed every 60s</div>
            <h2 className="font-display text-3xl font-medium tracking-[-0.02em] mb-6">Scored Base token opportunities.</h2>
            {opps.length === 0 ? (
              <p className="text-white/55 text-[14px]">Root opportunity feed momentarily empty — it&apos;s fetched live from <code>mcp.rootedge.ai</code>; refresh in a minute.</p>
            ) : (
              <div className="border border-white/10 rounded-sm overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead className="bg-white/[0.03] text-white/55 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2.5">score</th>
                      <th className="text-left px-3 py-2.5">symbol</th>
                      <th className="text-left px-3 py-2.5">name</th>
                      <th className="text-left px-3 py-2.5">chain</th>
                      <th className="text-left px-3 py-2.5">address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {opps.map((o, i) => (
                      <tr key={i} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5 font-mono text-cyan-300/90">{o.score ?? "—"}</td>
                        <td className="px-3 py-2.5 font-mono text-white/85">${o.launch?.tokenSymbol ?? "?"}</td>
                        <td className="px-3 py-2.5 text-white/85">{o.launch?.tokenName ?? "—"}</td>
                        <td className="px-3 py-2.5 text-white/55 lowercase">{o.launch?.chain ?? "base"}</td>
                        <td className="px-3 py-2.5 font-mono text-white/55">{short(o.launch?.tokenAddress)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* how to use it */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 py-14">
            <h2 className="font-display text-3xl font-medium tracking-[-0.02em] mb-6">Ask Root from any agent.</h2>
            <p className="text-white/60 max-w-2xl text-[15px] leading-relaxed mb-6">
              Hit the SIGNA endpoint directly, or DM the Root agent on the wire — the reply is wallet-signed and
              re-verifiable. No API key on either side.
            </p>
            <pre className="text-[12.5px] bg-black/40 border border-white/10 rounded-sm p-4 overflow-x-auto font-mono leading-relaxed whitespace-pre">{`# live Base market read, proxied from Root's MCP
curl "${BASE_URL}/api/partners/root?tool=summary"
curl "${BASE_URL}/api/partners/root?tool=feargreed"
curl "${BASE_URL}/api/partners/root?tool=opportunities"
curl "${BASE_URL}/api/partners/root?tool=launches"

# or from inside any agent runtime, on the wire:
node signa.mjs send <root-agent> "root, what's the base market read?"`}</pre>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
