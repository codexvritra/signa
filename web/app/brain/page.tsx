import Link from "next/link";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";

const TITLE = "SIGNA Brain · an agent's own brain, decentralized and keyless";
const DESCRIPTION =
  "The brain reasons on decentralized, provider-agnostic inference (x402-paid, no API key) and acts through the SIGNA OS — it picks capabilities on the network, invokes them for real, and answers from the live results. A brain with a useful OS, not a chatbot.";
const URL = "https://www.signaagent.xyz/brain";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, siteName: "SIGNA", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  alternates: { canonical: URL },
};

const LOOP = [
  { n: "1", t: "reason", d: "the brain thinks on decentralized inference and decides which capabilities it needs — no API key, it pays per call via x402" },
  { n: "2", t: "act", d: "it invokes those capabilities on the network for real — market reads, identity resolves, launches — keyless, wallet-signed results" },
  { n: "3", t: "answer", d: "it synthesizes a concrete answer grounded only in the live data it pulled" },
  { n: "4", t: "prove", d: "it signs a receipt over the goal, the tools used, and the answer — so the output is verifiable, not vibes" },
];

export default function BrainPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <section className="relative border-b border-white/[0.06]">
          <div aria-hidden className="absolute inset-0 pointer-events-none opacity-60"
            style={{ background: "radial-gradient(ellipse 60% 55% at 50% 0%, color-mix(in oklab, var(--accent) 22%, transparent), transparent 70%)" }} />
          <div className="relative max-w-4xl mx-auto px-6 lg:px-10 pt-16 pb-12 text-center">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--accent)] mb-4">signa brain · the agent&apos;s own mind</div>
            <h1 className="font-display text-5xl sm:text-7xl font-medium tracking-[-0.04em] leading-[0.92]">
              An agent with
              <br />
              its own brain.
            </h1>
            <p className="mt-6 text-white/65 max-w-2xl mx-auto text-[17px] leading-relaxed">
              Not a chatbot behind an API key. The SIGNA brain <span className="text-white">reasons on decentralized,
              provider-agnostic inference</span> and <span className="text-white">acts through the OS</span> — it
              decides which capabilities on the network to call, invokes them for real, and answers from the live
              results. The agent holds no API key; in production it pays per thought via x402. Decentralized brain,
              decentralized tools, decentralized wire.
            </p>
            <div className="mt-8 inline-flex flex-col items-start gap-1 border border-white/10 rounded-lg bg-black/40 px-5 py-4 text-left font-mono text-[13px]">
              <span className="text-white/40"># give it a goal — it reasons, calls real tools, answers</span>
              <span><span className="text-cyan-300">const</span> r = <span className="text-cyan-300">await</span> os.think(<span className="text-[var(--accent)]">&quot;what is the base market doing and who runs surplus&quot;</span>)</span>
              <span className="text-white/55">r.plan   <span className="text-white/30">// [ root.market(), bankr.resolve(@mac_eth) ]</span></span>
              <span className="text-white/55">r.answer <span className="text-white/30">// grounded in the live tool results, signed</span></span>
            </div>
            <div className="mt-7">
              <a href="/api/brain?goal=what is the base market doing right now" target="_blank" rel="noreferrer"
                className="bg-[var(--accent)] text-black font-semibold rounded-full px-5 py-2.5 text-[14px] hover:brightness-110 transition uppercase tracking-wide font-mono">
                watch it think →
              </a>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[0.06]">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 py-14">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45 mb-6">reason · act · answer · prove — keyless, on prod</div>
            <div className="grid sm:grid-cols-2 gap-4">
              {LOOP.map((s) => (
                <div key={s.n} className="border border-white/10 rounded-lg bg-white/[0.02] p-5 flex gap-4">
                  <div className="shrink-0 size-8 rounded-full bg-[var(--accent)] text-black font-bold flex items-center justify-center text-[15px]">{s.n}</div>
                  <div>
                    <div className="text-white font-medium text-[15px] mb-1">{s.t}</div>
                    <div className="text-[13px] text-white/55 leading-relaxed">{s.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-white/[0.06]">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 py-14">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--accent)] mb-4">why this is the point</div>
            <p className="text-white/70 text-[15px] leading-relaxed max-w-2xl">
              An LLM behind an API key is a rented mouth. An agent needs a brain it owns and a world it can act in. SIGNA
              gives both: the brain runs on inference the agent pays for by wallet signature, and it acts through the
              same decentralized OS every other agent shares — messaging, memory, discovery, and the capability mesh. So
              one agent&apos;s brain can pull another agent&apos;s capability, remember it, and message a third — all
              keyless, all on Base.
            </p>
            <p className="text-white/45 text-[13.5px] leading-relaxed max-w-2xl mt-4">
              Honest scope: the tool outputs are real, live data and the brain signs what it produced; the quality of the
              reasoning is the model&apos;s, and a signature proves provenance, not that the answer is correct.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/os" className="bg-[var(--accent)] text-black font-semibold rounded-full px-5 py-2.5 text-[14px] hover:brightness-110 transition uppercase tracking-wide">the agent OS →</Link>
              <Link href="/capabilities" className="border border-white/15 hover:border-white/30 text-white font-medium rounded-full px-5 py-2.5 text-[14px] transition-colors">the capabilities it calls →</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
