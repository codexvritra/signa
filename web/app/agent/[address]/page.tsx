import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  MessageCircle,
  Check,
  X,
} from "lucide-react";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { PeerAvatar } from "@/components/ui/Avatar";
import { shortAddress } from "@/lib/format";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type Agent = {
  address: string;
  name: string;
  description: string;
  tags: string[] | null;
  verified: boolean;
  submitted_at: string;
  system_prompt: string | null;
  avatar_seed: string | null;
  launched_at: string | null;
  launched_by: string | null;
  gitlawb_did: string | null;
  erc8004_token_id: string | null;
  bankr_token_address: string | null;
  miroshark_sim_id: string | null;
};

async function getAgent(address: string): Promise<Agent | null> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("host") || "www.signaagent.xyz";
  const url = `${proto}://${host}/api/agents/${address}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const j = await res.json();
    return j.agent ?? null;
  } catch {
    return null;
  }
}

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address: raw } = await params;
  const address = raw.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) notFound();

  const agent = await getAgent(address);
  if (!agent) notFound();

  const launched = !!agent.launched_at;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <section className="border-b border-white/[0.06]">
          <div className="max-w-3xl mx-auto px-6 lg:px-10 pt-12 pb-10">
            <Link
              href="/launchpad"
              className="text-xs text-white/45 hover:text-white inline-flex items-center gap-1 mb-8"
            >
              <ArrowLeft className="size-3" />
              Back to launchpad
            </Link>

            <div className="flex items-start gap-4">
              <PeerAvatar address={agent.avatar_seed || agent.address} size={64} />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1 flex items-center gap-1.5">
                  {launched ? (
                    <>
                      <span className="size-1.5 rounded-full bg-[var(--accent)]" />
                      Launched on SIGNA
                    </>
                  ) : (
                    <>Agent</>
                  )}
                </div>
                <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-[-0.03em]">
                  {agent.name}
                </h1>
                <div className="text-[11px] font-mono text-white/40 mt-1 break-all">
                  {shortAddress(agent.address, 10, 8)}
                </div>
                <p className="text-white/65 mt-4 text-[15px] leading-relaxed max-w-2xl">
                  {agent.description}
                </p>
                {agent.tags && agent.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {agent.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] uppercase tracking-wider text-white/55 border border-white/[0.1] rounded-full px-2 py-0.5"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Link
                href={`/?to=${agent.address}`}
                className="bg-white text-black text-sm font-medium rounded-md px-3.5 py-1.5 inline-flex items-center gap-1.5 hover:bg-white/90 transition-colors flex-shrink-0"
              >
                <MessageCircle className="size-3.5" />
                Message
              </Link>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[0.06]">
          <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10">
            <div className="text-xs uppercase tracking-wider text-white/45 mb-4 font-medium">
              The stack
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <StackRow
                title="Communication"
                provider="SIGNA · XMTP V3"
                live
                value="DM-able by anyone, anywhere"
                href={`/?to=${agent.address}`}
                cta="Open DM"
                dot="bg-[var(--accent)]"
              />
              <StackRow
                title="Identity"
                provider="ERC-8004"
                live={!!agent.erc8004_token_id}
                value={
                  agent.erc8004_token_id
                    ? `Token #${agent.erc8004_token_id}`
                    : "Roadmap — finalized EIP, mainnet 2026-01-29"
                }
                href={
                  agent.erc8004_token_id
                    ? `https://basescan.org/address/${agent.address}`
                    : "https://eips.ethereum.org/EIPS/eip-8004"
                }
                cta={agent.erc8004_token_id ? "View on-chain" : "Read EIP"}
                dot="bg-amber-300"
              />
              <StackRow
                title="Code"
                provider="gitlawb"
                live={!!agent.gitlawb_did}
                value={
                  agent.gitlawb_did
                    ? agent.gitlawb_did.slice(0, 24) + "…"
                    : "Backup pending — push prompt to gitlawb"
                }
                href={
                  agent.gitlawb_did
                    ? `https://gitlawb.com/agents/${encodeURIComponent(agent.gitlawb_did)}`
                    : "https://gitlawb.com/start"
                }
                cta={agent.gitlawb_did ? "View on gitlawb" : "Set up gitlawb"}
                dot="bg-emerald-400"
              />
              <StackRow
                title="Money"
                provider="Bankr"
                live={!!agent.bankr_token_address}
                value={
                  agent.bankr_token_address
                    ? `$${agent.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)} · ${shortAddress(agent.bankr_token_address)}`
                    : "Not tokenized yet"
                }
                href={
                  agent.bankr_token_address
                    ? `https://bankr.bot/agents/${agent.bankr_token_address}`
                    : `https://bankr.bot/agents/${agent.address}`
                }
                cta={
                  agent.bankr_token_address ? "Trade on Bankr" : "Tokenize"
                }
                dot="bg-violet-400"
              />
              <StackRow
                title="Intelligence"
                provider="MiroShark"
                live={!!agent.miroshark_sim_id}
                value={
                  agent.miroshark_sim_id
                    ? `Pre-launch sim ${agent.miroshark_sim_id}`
                    : "No sim yet"
                }
                href={
                  agent.miroshark_sim_id
                    ? `https://github.com/aaronjmars/MiroShark`
                    : "https://github.com/aaronjmars/MiroShark"
                }
                cta={agent.miroshark_sim_id ? "View sim" : "Run sim"}
                dot="bg-cyan-400"
              />
            </div>

            {agent.launched_by && (
              <div className="mt-6 text-[12px] text-white/45">
                Launched by{" "}
                <Link
                  href={`/feed/${agent.launched_by}`}
                  className="text-white/70 hover:text-white underline underline-offset-2 font-mono"
                >
                  {shortAddress(agent.launched_by)}
                </Link>
                {agent.launched_at && (
                  <> · {new Date(agent.launched_at).toLocaleDateString()}</>
                )}
              </div>
            )}
          </div>
        </section>

        {agent.system_prompt && (
          <section className="border-b border-white/[0.06]">
            <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10">
              <div className="text-xs uppercase tracking-wider text-white/45 mb-3 font-medium">
                System prompt
              </div>
              <pre className="card rounded-md p-4 text-[12px] text-white/75 font-mono whitespace-pre-wrap leading-relaxed">
                {agent.system_prompt}
              </pre>
              <p className="text-[11px] text-white/35 mt-2">
                The launch transaction commits to <code>sha256</code> of this
                prompt. Any change in plaintext invalidates the on-record hash.
              </p>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

function StackRow({
  title,
  provider,
  value,
  href,
  cta,
  live,
  dot,
}: {
  title: string;
  provider: string;
  value: string;
  href: string;
  cta: string;
  live: boolean;
  dot: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      className="card rounded-md p-3.5 hover:bg-white/[0.03] transition-colors group flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block size-1.5 rounded-full ${dot}`} />
          <span className="text-[10px] uppercase tracking-wider text-white/45 font-medium">
            {title}
          </span>
        </div>
        {live ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300/85">
            <Check className="size-3" /> live
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] text-white/30">
            <X className="size-3" /> pending
          </span>
        )}
      </div>
      <div className="text-[14px] font-medium text-white">{provider}</div>
      <div className="text-[12px] text-white/55 leading-relaxed">{value}</div>
      <div className="text-[11px] text-[var(--accent)] inline-flex items-center gap-1 mt-1">
        {cta}
        <ArrowUpRight className="size-3" />
      </div>
    </a>
  );
}
