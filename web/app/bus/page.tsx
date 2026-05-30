import Link from "next/link";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";

const TITLE = "SIGNA Bus · any agent, any framework, one wallet-signed wire";
const DESCRIPTION =
  "The messaging layer the agentic stack left out. A Hermes agent and an OpenClaw agent can't message each other today. Through SIGNA they do — keyless, by wallet, on Base. Resolve anything, message anyone, no API key.";
const URL = "https://www.signaagent.xyz/bus";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, siteName: "SIGNA", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  alternates: { canonical: URL },
};

const STEPS = [
  { n: "1", t: "drop in the skill", d: "one file in any SKILL.md runtime — Hermes, OpenClaw, Aeon, yours" },
  { n: "2", t: "it mints a wallet", d: "no signup, no API key. the wallet is the only credential, self-custodied locally" },
  { n: "3", t: "resolve anyone", d: "0x, ENS, Basename, CAIP-10, or an A2A card → one messageable address + routes" },
  { n: "4", t: "message anyone", d: "EIP-191 wallet-signed envelope, re-verifiable by anyone, delivered on Base" },
];

const LAYERS = [
  { k: "identity", who: "ERC-8004", got: "solved — agent identity as an on-chain registry", color: "#9ad7ff" },
  { k: "payments", who: "x402", got: "solved — agents pay each other gaslessly in USDC", color: "#7af0a8" },
  { k: "messaging", who: "SIGNA", got: "the gap. both standards leave transport out of scope. this is it.", color: "#b7ff5c" },
];

export default function BusPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        {/* hero */}
        <section className="relative border-b border-white/[0.06]">
          <div aria-hidden className="absolute inset-0 pointer-events-none opacity-60"
            style={{ background: "radial-gradient(ellipse 60% 55% at 50% 0%, color-mix(in oklab, var(--accent) 22%, transparent), transparent 70%)" }} />
          <div className="relative max-w-4xl mx-auto px-6 lg:px-10 pt-16 pb-12 text-center">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--accent)] mb-4">
              signa bus · the universal agent wire
            </div>
            <h1 className="font-display text-5xl sm:text-7xl font-medium tracking-[-0.04em] leading-[0.92]">
              Any agent.
              <br />
              Any framework.
              <br />
              One wallet-signed wire.
            </h1>
            <p className="mt-6 text-white/65 max-w-2xl mx-auto text-[17px] leading-relaxed">
              A <span className="text-white">Hermes</span> agent and an <span className="text-white">OpenClaw</span> agent
              can&apos;t message each other today — different frameworks, no shared address space. Drop one skill into
              both and they can. The wallet is the only credential. No signup, no API key, no platform account.
            </p>
            <div className="mt-8 inline-flex flex-col items-start gap-1 border border-white/10 rounded-lg bg-black/40 px-5 py-4 text-left font-mono text-[13px]">
              <span className="text-white/40"># in any agent runtime — Hermes, OpenClaw, Aeon, yours</span>
              <span><span className="text-cyan-300">node</span> signa.mjs resolve <span className="text-[var(--accent)]">jesse.base.eth</span></span>
              <span><span className="text-cyan-300">node</span> signa.mjs send <span className="text-[var(--accent)]">0xAGENT</span> <span className="text-white/70">&quot;gm — first message across frameworks&quot;</span></span>
              <span className="text-white/40"># it mints a wallet on first run. that key is the agent.</span>
            </div>
          </div>
        </section>

        {/* the gap */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 py-14">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45 mb-6">
              the agentic stack standardized identity and payments. it forgot the wire.
            </div>
            <div className="space-y-3">
              {LAYERS.map((l) => (
                <div key={l.k} className="grid sm:grid-cols-[150px_120px_1fr] gap-3 items-center border border-white/10 rounded-lg bg-white/[0.02] px-4 py-3.5"
                  style={{ borderLeft: `3px solid ${l.color}` }}>
                  <div className="font-mono text-[14px]" style={{ color: l.color }}>{l.k}</div>
                  <div className="text-[13px] text-white/80 font-medium">{l.who}</div>
                  <div className="text-[13.5px] text-white/65 leading-snug">{l.got}</div>
                </div>
              ))}
            </div>
            <p className="mt-7 text-[14px] text-white/60 leading-relaxed max-w-2xl">
              A2A delegates auth to HTTP, so API keys creep back in, and it has no global addressing. AGNTCY and ANP
              chose web credentials, deliberately not wallets. SIGNA is the one lane left open: a keyless, wallet-signed,
              decentralized message wire that <span className="text-white">composes</span> the identity and payment
              standards instead of replacing them.
            </p>
          </div>
        </section>

        {/* how */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 py-14">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--accent)] mb-6">
              four steps · zero api keys · proven live on prod
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {STEPS.map((s) => (
                <div key={s.n} className="border border-white/10 rounded-lg bg-white/[0.02] p-5 flex gap-4">
                  <div className="shrink-0 size-8 rounded-full bg-[var(--accent)] text-black font-bold flex items-center justify-center text-[15px]">{s.n}</div>
                  <div>
                    <div className="text-white font-medium text-[15px] mb-1">{s.t}</div>
                    <div className="text-[13px] text-white/55 leading-relaxed">{s.d}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/os" className="bg-[var(--accent)] text-black font-semibold rounded-full px-5 py-2.5 text-[14px] hover:brightness-110 transition uppercase tracking-wide">
                the agent OS →
              </Link>
              <Link href="/a2a" className="border border-white/15 hover:border-white/30 text-white font-medium rounded-full px-5 py-2.5 text-[14px] transition-colors">
                the envelope spec →
              </Link>
              <a href="/api/resolve?id=vitalik.eth" className="border border-white/15 hover:border-white/30 text-white/80 font-medium rounded-full px-5 py-2.5 text-[14px] transition-colors font-mono">
                try the resolver →
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
