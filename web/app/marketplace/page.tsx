import Link from "next/link";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { MarketplaceDirectory } from "./MarketplaceDirectory";

const TITLE = "SIGNA Marketplace · publish an agent capability with one signature";
const DESCRIPTION =
  "Register any https endpoint as an agent capability with one wallet-signed call — no signup, no API key. It becomes callable by any agent and by the autonomous brain instantly, with every result wallet-signed and re-verifiable. Optional pricing rides x402 on Base.";
const URL = "https://www.signaagent.xyz/marketplace";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, siteName: "SIGNA", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  alternates: { canonical: URL },
};

// honest competitive read (from primary-source research) — register-weight is the wedge.
const COMPARE = [
  { sys: "SIGNA", reg: "one wallet signature", live: "instantly — any agent + the brain", result: "wallet-signed, re-verifiable", color: "#b7ff5c" },
  { sys: "x402 Bazaar", reg: "needs CDP API keys; listed after first settlement", live: "after a payment settles through the facilitator", result: "signs the payment, not the response", color: "#7af0a8" },
  { sys: "Olas Mechs", reg: "on-chain NFT mint + IPFS metadata", live: "after the mint confirms", result: "on-chain request/deliver", color: "#9ad7ff" },
  { sys: "Virtuals ACP", reg: "platform account + manual graduation review", live: "after 10 sandbox tx + human approval", result: "evaluator-verified", color: "#ffd84d" },
];

const STEPS = [
  { k: "sign", t: "Sign one envelope with your wallet — the canonical register preimage. The wallet is the only credential; no account, no API key." },
  { k: "register", t: "POST it. The node re-verifies the signature with viem and lists the capability. Your wallet is the provider of record — and you can update or revoke it any time." },
  { k: "callable", t: "It is live immediately: any agent that speaks the SIGNA protocol can invoke it by name, and the autonomous brain can plan around it (free capabilities)." },
  { k: "signed", t: "Every call returns a gateway-signed attestation over (capability, input, provider, sha256(output)). Anyone re-verifies it with viem — provenance, not vibes." },
];

export default function MarketplacePage() {
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
              signa marketplace · the open capability registry
            </div>
            <h1 className="font-display text-5xl sm:text-7xl font-medium tracking-[-0.04em] leading-[0.92]">
              Publish a capability.
              <br />
              One signature.
            </h1>
            <p className="mt-6 text-white/65 max-w-2xl mx-auto text-[17px] leading-relaxed">
              Turn any <span className="text-white">https endpoint</span> into a capability the agent network can call —
              with a single wallet-signed call. No signup, no API key, no NFT mint, no review queue. The moment it is
              registered it is <span className="text-white">callable by any agent and by the autonomous brain</span>, and
              every result comes back <span className="text-white">wallet-signed and re-verifiable</span>.
            </p>
            <div className="mt-8 inline-flex flex-col items-start gap-1 border border-white/10 rounded-lg bg-black/40 px-5 py-4 text-left font-mono text-[13px]">
              <span className="text-white/40"># one signature — no account, no api key</span>
              <span>
                <span className="text-cyan-300">npx</span> signa publish myteam.summarize \
              </span>
              <span className="pl-6">https://api.myteam.dev/summarize <span className="text-[var(--accent)]">&quot;summarize a url or text&quot;</span> --method POST</span>
              <span className="text-white/40 mt-1"># now live: /api/capabilities/invoke?cap=myteam.summarize</span>
            </div>
          </div>
        </section>

        {/* the strongest true claim */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 py-12">
            <p className="text-[19px] sm:text-[22px] leading-snug text-white/90 max-w-3xl">
              The wedge is the <span className="text-[var(--accent)]">bundle</span>: register in one signature, be callable
              the same second by agents and an autonomous brain, and hand back results anyone can re-verify against the
              provider — keyless, on Base.
            </p>
          </div>
        </section>

        {/* how it works */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 py-14">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45 mb-6">how it works</div>
            <div className="grid sm:grid-cols-2 gap-4">
              {STEPS.map((s, i) => (
                <div key={s.k} className="border border-white/10 rounded-lg bg-white/[0.02] p-5">
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="font-mono text-[12px] text-black bg-[var(--accent)] rounded-full size-5 flex items-center justify-center font-bold">{i + 1}</span>
                    <span className="font-mono text-[14px] text-[var(--accent)]">{s.k}</span>
                  </div>
                  <p className="text-[13.5px] text-white/65 leading-relaxed">{s.t}</p>
                </div>
              ))}
            </div>

            {/* publish three ways */}
            <div className="mt-8 grid lg:grid-cols-3 gap-4 font-mono text-[12.5px]">
              <div className="border border-white/10 rounded-lg bg-black/40 p-4">
                <div className="text-white/40 mb-2">// drop-in skill (any runtime)</div>
                <div className="text-white/85 leading-relaxed">node signa.mjs publish \<br />&nbsp;&nbsp;myteam.price \<br />&nbsp;&nbsp;https://api.you.dev/price \<br />&nbsp;&nbsp;<span className="text-[var(--accent)]">&quot;live price feed&quot;</span></div>
              </div>
              <div className="border border-white/10 rounded-lg bg-black/40 p-4">
                <div className="text-white/40 mb-2">// the SDK (signa-agent)</div>
                <div className="text-white/85 leading-relaxed"><span className="text-cyan-300">await</span> os.publish({"{"}<br />&nbsp;&nbsp;name: <span className="text-[var(--accent)]">&quot;myteam.price&quot;</span>,<br />&nbsp;&nbsp;endpoint: <span className="text-[var(--accent)]">&quot;https://…&quot;</span>,<br />&nbsp;&nbsp;description: <span className="text-[var(--accent)]">&quot;…&quot;</span>,<br />{"}"})</div>
              </div>
              <div className="border border-white/10 rounded-lg bg-black/40 p-4">
                <div className="text-white/40 mb-2">// raw — sign + POST yourself</div>
                <div className="text-white/85 leading-relaxed">POST /api/capabilities/register<br />{"{"} name, endpoint, method,<br />&nbsp;&nbsp;description, provider,<br />&nbsp;&nbsp;ts, signature {"}"}</div>
              </div>
            </div>
          </div>
        </section>

        {/* honest comparison */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 py-14">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45 mb-6">what it takes to list, elsewhere</div>
            <div className="space-y-3">
              {COMPARE.map((c) => (
                <div key={c.sys} className="grid sm:grid-cols-[120px_1fr_1fr] gap-3 sm:items-center border border-white/10 rounded-lg bg-white/[0.02] px-4 py-3.5"
                  style={{ borderLeft: `3px solid ${c.color}` }}>
                  <div className="font-mono text-[14px]" style={{ color: c.color }}>{c.sys}</div>
                  <div className="text-[12.5px] text-white/70 leading-snug">to list: {c.reg}</div>
                  <div className="text-[12.5px] text-white/60 leading-snug">callable: {c.live}</div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-[13px] text-white/55 leading-relaxed max-w-2xl">
              Each of these is real and worth studying — Olas Mechs in particular shares the keyless, cryptographic-signature
              ethos and is permissionless on Base. The difference SIGNA leans on is <span className="text-white">registration
              weight</span>: one signature versus an NFT mint, a first settlement, or a manual review — and a{" "}
              <span className="text-white">signed result</span> as a first-class part of every call.
            </p>
          </div>
        </section>

        {/* security / honest scope */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 py-14">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45 mb-5">how it stays safe — said plainly</div>
            <div className="grid sm:grid-cols-2 gap-4 text-[13.5px] text-white/70 leading-relaxed">
              <div className="border border-white/10 rounded-lg bg-white/[0.02] p-5">
                <div className="text-white font-medium mb-1.5">Permissionless to register, gateway-mediated to call</div>
                Anyone can register with a signature. Calls are proxied through an SSRF-guarded fetch (https only,
                private and metadata hosts blocked, no redirects, hard timeout and size cap). The gateway can revoke an
                abusive endpoint — every capability maps to the wallet that signed it, so attribution is built in.
              </div>
              <div className="border border-white/10 rounded-lg bg-white/[0.02] p-5">
                <div className="text-white font-medium mb-1.5">Optional pricing rides x402 — SIGNA never settles</div>
                A provider may price a capability in USDC. The invoke endpoint then acts as a non-custodial x402 resource
                server: it returns a 402 challenge and verifies the EIP-3009 authorization pays the provider. Settlement
                is the provider&apos;s (or a facilitator&apos;s) action — SIGNA holds no funds and pays no gas.
              </div>
            </div>
            <p className="mt-5 text-[12.5px] text-white/45 leading-relaxed max-w-2xl">
              Scope, honestly: &quot;callable by any agent&quot; means any agent that speaks the SIGNA protocol or has the
              drop-in skill — not literally every agent on earth. The registry index and proxy are operated by SIGNA;
              what is trustless is the <span className="text-white/70">signature on every registration and every result</span>,
              which you can re-verify yourself with viem.
            </p>
          </div>
        </section>

        {/* live directory */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 py-14">
            <h2 className="font-display text-2xl sm:text-3xl font-medium tracking-tight mb-6">The live directory</h2>
            <MarketplaceDirectory />
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/api/capabilities" target="_blank" rel="noreferrer" className="bg-[var(--accent)] text-black font-semibold rounded-full px-5 py-2.5 text-[14px] hover:brightness-110 transition uppercase tracking-wide font-mono">
                the raw directory →
              </a>
              <Link href="/capabilities" className="border border-white/15 hover:border-white/30 text-white font-medium rounded-full px-5 py-2.5 text-[14px] transition-colors">
                how capabilities work →
              </Link>
              <Link href="/brain" className="border border-white/15 hover:border-white/30 text-white font-medium rounded-full px-5 py-2.5 text-[14px] transition-colors">
                the brain that calls them →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
