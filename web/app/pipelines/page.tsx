import Link from "next/link";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { PipelineDemo } from "./PipelineDemo";

const TITLE = "SIGNA Signed Pipelines · verifiable multi-provider agent runs on Base";
const DESCRIPTION =
  "Compose capabilities from different providers into one run that emits a single wallet-signed, hash-chained provenance chain — every step's provider, input, and output linked and independently re-verifiable with viem. Provenance, not correctness. Keyless, on Base.";
const URL = "https://www.signaagent.xyz/pipelines";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, siteName: "SIGNA", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  alternates: { canonical: URL },
};

// honest competitive read (research-validated). Each is real; none ships our exact thing on Base.
const NEAREST = [
  { sys: "Virtuals ACP", note: "job chaining with per-job, trust-based human/agent evaluation — not a cryptographic re-verifiable chain", color: "#ffd84d" },
  { sys: "Microsoft Agent Toolkit", note: "Ed25519 hash-chained receipts across handoffs — off-chain, enterprise, no wallet or payment binding, not on Base", color: "#9ad7ff" },
  { sys: "IETF intent-chain draft", note: "specifies a Merkle output→input chain — draft only, unimplemented, not blockchain", color: "#7af0a8" },
];

const PARTNER_STEPS = [
  { who: "Root Edge", step: "market read", role: "context", color: "#9ad7ff" },
  { who: "MiroShark", step: "swarm simulation", role: "analysis", color: "#b7ff5c" },
  { who: "Surplus", step: "cheapest-route inference", role: "compute", color: "#7af0a8" },
  { who: "Bankr", step: "the onchain action", role: "settlement", color: "#ffd84d" },
  { who: "Aeon", step: "schedule the whole run", role: "autonomy", color: "#ff9ad7" },
];

export default function PipelinesPage() {
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
              signa signed pipelines · verifiable multi-provider runs
            </div>
            <h1 className="font-display text-5xl sm:text-7xl font-medium tracking-[-0.04em] leading-[0.92]">
              Compose providers.
              <br />
              Get one proof.
            </h1>
            <p className="mt-6 text-white/65 max-w-2xl mx-auto text-[17px] leading-relaxed">
              Chain capabilities from <span className="text-white">different, independent providers</span> into a single
              run. Every step&apos;s provider, input, and output is hashed and signed, and each link is chained to the
              last — so the whole run emits <span className="text-white">one wallet-signed provenance chain</span> anyone
              can re-verify with viem. Who produced what, in what order, provably.
            </p>
            <p className="mt-4 text-[13px] text-white/45 max-w-2xl mx-auto">
              As far as we can tell this is the first wallet-signed (EIP-191), viem-re-verifiable provenance chain across
              independent capability providers on Base. It proves <span className="text-white/70">provenance, not
              correctness</span>: who answered and in what order, not that the answer is true.
            </p>
          </div>
        </section>

        {/* live demo */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 py-14">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--accent)] mb-2">run it now · live on prod</div>
            <p className="text-white/60 text-[14px] leading-relaxed mb-6 max-w-2xl">
              A three-step pipeline across two providers: a Root-Edge-style market read, a live ETH price, then a
              reasoning step that composes both. Run it, then re-verify the whole chain — every link is signed by the
              gateway and hash-chained to the previous one.
            </p>
            <PipelineDemo />
          </div>
        </section>

        {/* how the chain works */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 py-14">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45 mb-6">the provenance chain</div>
            <div className="font-mono text-[12.5px] text-white/75 border border-white/10 rounded-lg bg-black/40 p-5 leading-relaxed overflow-x-auto">
              <div className="text-white/40">// each link, signed by the gateway wallet (EIP-191)</div>
              <div>link[i] = {"{"} step, cap, <span className="text-[var(--accent)]">provider</span>, input_hash, output_hash,</div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;prev: <span className="text-cyan-300">sha256(link[i-1].signature)</span>, ts {"}"}</div>
              <div className="mt-1">signature[i] = gateway.sign(link[i])</div>
              <div>root = sha256(signature[last])</div>
              <div className="text-white/40 mt-2">// tamper any step and every downstream signature breaks</div>
            </div>
            <p className="mt-5 text-[13.5px] text-white/55 leading-relaxed max-w-2xl">
              Change a step&apos;s output, reorder the run, or swap a provider and the hash chain no longer verifies. The
              run returns each real output too, so a verifier recomputes every hash and confirms the signed links match.
              Steps pass data forward with <span className="font-mono text-white/70">{"{{prev}}"}</span> /
              <span className="font-mono text-white/70"> {"{{0.output.field}}"}</span> templating.
            </p>
          </div>
        </section>

        {/* partner composition */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 py-14">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45 mb-2">every provider is one composable step</div>
            <p className="text-white/60 text-[14px] leading-relaxed mb-6 max-w-2xl">
              The whole Base agent stack becomes Lego. One pipeline can run a market read, a swarm simulation, cheapest-route
              inference, an onchain action, and schedule the lot — each a signed link in the same chain.
            </p>
            <div className="space-y-3">
              {PARTNER_STEPS.map((p, i) => (
                <div key={p.who} className="flex items-center gap-4 border border-white/10 rounded-lg bg-white/[0.02] px-4 py-3" style={{ borderLeft: `3px solid ${p.color}` }}>
                  <div className="font-mono text-[12px] text-white/40 w-5">{i + 1}</div>
                  <div className="font-mono text-[14px]" style={{ color: p.color }}>{p.who}</div>
                  <div className="text-[13px] text-white/65">{p.step}</div>
                  <div className="ml-auto text-[11px] uppercase tracking-wide text-white/35">{p.role}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* honest scope */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 py-14">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45 mb-5">said plainly</div>
            <div className="grid sm:grid-cols-2 gap-4 text-[13.5px] text-white/70 leading-relaxed">
              <div className="border border-white/10 rounded-lg bg-white/[0.02] p-5">
                <div className="text-white font-medium mb-1.5">Provenance, not correctness</div>
                The chain proves which provider produced which output, in which order, and that nothing was altered after
                signing. It does <span className="text-white">not</span> prove the output is true — garbage in still
                signs. Same honest line ERC-8004&apos;s validation registry draws.
              </div>
              <div className="border border-white/10 rounded-lg bg-white/[0.02] p-5">
                <div className="text-white font-medium mb-1.5">Keyless + non-custodial, not &quot;decentralized&quot;</div>
                SIGNA orchestrates the run, so this is not trustless consensus. What is trustless is the proof: every
                link is wallet-signed and re-verifiable by anyone with viem, no trust in SIGNA required. Priced steps go
                through x402 directly; the pipeline never custodies funds.
              </div>
            </div>
            <div className="mt-5 text-[12.5px] text-white/45 leading-relaxed max-w-2xl">
              Nearest analogs, named honestly — none ships this on Base:
              <div className="mt-3 space-y-2">
                {NEAREST.map((n) => (
                  <div key={n.sys} className="flex gap-3"><span className="font-mono text-[12px] shrink-0" style={{ color: n.color }}>{n.sys}</span><span>{n.note}</span></div>
                ))}
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/api/pipelines/run" target="_blank" rel="noreferrer" className="bg-[var(--accent)] text-black font-semibold rounded-full px-5 py-2.5 text-[14px] hover:brightness-110 transition uppercase tracking-wide font-mono">
                the run endpoint →
              </a>
              <Link href="/marketplace" className="border border-white/15 hover:border-white/30 text-white font-medium rounded-full px-5 py-2.5 text-[14px] transition-colors">
                the capability marketplace →
              </Link>
              <Link href="/capabilities" className="border border-white/15 hover:border-white/30 text-white font-medium rounded-full px-5 py-2.5 text-[14px] transition-colors">
                how capabilities work →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
