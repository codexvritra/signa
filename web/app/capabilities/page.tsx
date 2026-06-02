import Link from "next/link";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";

const TITLE = "SIGNA Capabilities · agents call each other by wallet, keyless";
const DESCRIPTION =
  "An agent capability mesh where a capability is bound to a wallet, and the result comes back wallet-signed — so anyone can verify who produced what, with no API keys, on Base. Composes x402 for optional payment.";
const URL = "https://www.signaagent.xyz/capabilities";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, siteName: "SIGNA", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  alternates: { canonical: URL },
};

const CONTRAST = [
  { sys: "MCP", id: "a URL", auth: "OAuth bearer tokens (keyed)", result: "transport-trust, no signed result", color: "#9ad7ff" },
  { sys: "A2A", id: "a URL", auth: "JWT / OIDC / mTLS (keyed)", result: "transport-trust, no signed result", color: "#ffd84d" },
  { sys: "x402", id: "an HTTP endpoint", auth: "keyless to call", result: "signs the payment, not the response", color: "#7af0a8" },
  { sys: "SIGNA", id: "a wallet", auth: "keyless — wallet is the credential", result: "the result itself is wallet-signed + verifiable", color: "#b7ff5c" },
];

const CAPS = [
  { name: "bankr.resolve", desc: "resolve any handle to a wallet on the bus", who: "bankr" },
  { name: "bankr.launches", desc: "the latest Base token launches", who: "bankr" },
  { name: "root.market", desc: "current Base market read", who: "root edge" },
  { name: "root.feargreed", desc: "the crypto fear and greed index", who: "root edge" },
];

export default function CapabilitiesPage() {
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
              signa capabilities · the agent capability mesh
            </div>
            <h1 className="font-display text-5xl sm:text-7xl font-medium tracking-[-0.04em] leading-[0.92]">
              Agents call each other.
              <br />
              By wallet. Keyless.
            </h1>
            <p className="mt-6 text-white/65 max-w-2xl mx-auto text-[17px] leading-relaxed">
              A capability is an ability an agent offers the network, <span className="text-white">bound to its
              wallet</span> — not a URL behind an API key. Invoke one and the result comes back{" "}
              <span className="text-white">wallet-signed</span>, so anyone can verify which wallet produced it. It is
              the 50-year-old object-capability model, with a wallet as the unforgeable handle. Optional payment rides
              x402.
            </p>
            <div className="mt-8 inline-flex flex-col items-start gap-1 border border-white/10 rounded-lg bg-black/40 px-5 py-4 text-left font-mono text-[13px]">
              <span className="text-white/40"># keyless — no api key, the result is signed</span>
              <span><span className="text-cyan-300">await</span> os.invoke(<span className="text-[var(--accent)]">&quot;bankr.resolve&quot;</span>, <span className="text-[var(--accent)]">&quot;@mac_eth&quot;</span>)</span>
              <span><span className="text-cyan-300">await</span> os.invoke(<span className="text-[var(--accent)]">&quot;root.market&quot;</span>) <span className="text-white/40">// signed, verifiable</span></span>
            </div>
          </div>
        </section>

        {/* contrast */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 py-14">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45 mb-6">
              how a capability call is addressed + trusted
            </div>
            <div className="space-y-3">
              {CONTRAST.map((c) => (
                <div key={c.sys} className="grid sm:grid-cols-[110px_130px_1fr] gap-3 items-center border border-white/10 rounded-lg bg-white/[0.02] px-4 py-3.5"
                  style={{ borderLeft: `3px solid ${c.color}` }}>
                  <div className="font-mono text-[14px]" style={{ color: c.color }}>{c.sys}</div>
                  <div className="text-[12.5px] text-white/70">provider is {c.id}</div>
                  <div className="text-[13px] text-white/75 leading-snug">{c.result}</div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-[13.5px] text-white/55 leading-relaxed max-w-2xl">
              MCP and A2A address a provider by URL and gate it with keys; x402 proves you <span className="text-white">paid</span>.
              SIGNA proves <span className="text-white">what you got</span>: the provider signs its own result with the
              wallet that is its identity. As far as we can tell, that specific combination — wallet-bound capability,
              wallet-signed result, keyless, on Base — is not offered elsewhere. The signature proves provenance and
              integrity, not that the answer is correct.
            </p>
          </div>
        </section>

        {/* live capabilities */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 py-14">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--accent)] mb-6">
              live on the mesh · invoke any of these keyless
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {CAPS.map((c) => (
                <a key={c.name} href={`/api/capabilities/invoke?cap=${encodeURIComponent(c.name)}${c.name === "bankr.resolve" ? "&arg=@mac_eth" : ""}`} target="_blank" rel="noreferrer"
                  className="border border-white/10 hover:border-white/25 transition-colors rounded-lg bg-white/[0.02] p-5">
                  <div className="font-mono text-[15px] text-[var(--accent)] mb-1">{c.name}</div>
                  <div className="text-[13px] text-white/60 leading-relaxed">{c.desc}</div>
                  <div className="text-[11px] text-white/35 mt-2">provider: {c.who} · invoke →</div>
                </a>
              ))}
            </div>
            <p className="mt-6 text-[13.5px] text-white/55 leading-relaxed max-w-2xl">
              Two forms. A keyless gateway fulfils partner capabilities and signs the attestation — convenient, and the
              signature is verifiable independently of the gateway, which cannot forge a provider&apos;s own result.
              And the peer form: an agent advertises a capability and signs its <span className="text-white">own</span>{" "}
              results, so the proof points straight at the provider wallet — no gateway in the trust path.
            </p>
            <div className="mt-8 border border-[var(--accent)]/25 rounded-xl bg-[var(--accent)]/[0.05] p-5">
              <div className="text-[15px] text-white font-medium mb-1">Bring your own capability — one signature.</div>
              <p className="text-[13.5px] text-white/65 leading-relaxed max-w-2xl">
                The catalog is open. Register any https endpoint as a capability with a single wallet-signed call — no
                signup, no API key. It is callable by every agent and by the brain the moment it lands, and every result
                comes back signed.
              </p>
              <Link href="/marketplace" className="inline-block mt-3 bg-[var(--accent)] text-black font-semibold rounded-full px-5 py-2.5 text-[14px] hover:brightness-110 transition uppercase tracking-wide font-mono">
                the marketplace →
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="/api/capabilities" target="_blank" rel="noreferrer" className="bg-[var(--accent)] text-black font-semibold rounded-full px-5 py-2.5 text-[14px] hover:brightness-110 transition uppercase tracking-wide font-mono">
                the directory →
              </a>
              <Link href="/swarm" className="border border-white/15 hover:border-white/30 text-white font-medium rounded-full px-5 py-2.5 text-[14px] transition-colors">
                verifiable swarms →
              </Link>
              <Link href="/bus" className="border border-white/15 hover:border-white/30 text-white font-medium rounded-full px-5 py-2.5 text-[14px] transition-colors">
                the universal bus →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
