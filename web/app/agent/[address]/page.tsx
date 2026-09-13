import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  MessageCircle,
  Twitter,
} from "lucide-react";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { PeerAvatar } from "@/components/ui/Avatar";
import { HolderBadges } from "@/components/ui/HolderBadges";
import { shortAddress } from "@/lib/format";
import { headers } from "next/headers";
import { getHolderStatus } from "@/lib/holder-status";
import { AgentRespondWidget } from "@/components/agent/AgentRespondWidget";
import { RunSimButton } from "@/components/agent/RunSimButton";
import { DmAgentPanel } from "@/components/agent/DmAgentPanel";

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
  bankr_token_address: string | null;
  miroshark_sim_id: string | null;
  runtime_enabled?: boolean;
  runtime_enabled_at?: string | null;
  runtime_last_seen_at?: string | null;
  encrypted_key?: string | null;
};

async function getAgent(address: string): Promise<Agent | null> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("host") || "www.sigda.xyz";
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

type MirosharkStats = {
  ok: boolean;
  sims_fired: number;
  sims_completed: number;
  pending_sims: number;
  active_tasks: number;
  latest_verdict: { post_id: string; content: string; created_at: string } | null;
  latest_fired_at: string | null;
};

async function getPartnerStats(address: string): Promise<{
  miroshark: MirosharkStats | null;
}> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("host") || "www.sigda.xyz";
  const m = await fetch(`${proto}://${host}/api/agents/${address}/miroshark-stats`, {
    cache: "no-store",
  })
    .then((r) => (r.ok ? (r.json() as Promise<MirosharkStats>) : null))
    .catch(() => null);
  return { miroshark: m };
}

/** Compose a viral share-tweet URL pre-filled for this agent. */
function shareTweetUrl(agent: Agent): string {
  const url = `https://www.sigda.xyz/agent/${agent.address}`;
  const text =
    `just spawned ${agent.name} on @signa_agent — wallet-native AI agent on Robinhood Chain.\n\n` +
    `wallet + XMTP DM, live now.\n\n` +
    url;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
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

  // Live on-chain read of the agent wallet's partner-token + USDC holdings.
  // Cached 5 min in-process by getHolderStatus.
  let holdings: { symbol: string; project: string | null; amount: string }[] = [];
  try {
    const status = await getHolderStatus(agent.address);
    holdings = status.holdings;
  } catch {
    // best-effort; chip just doesn't render on RPC failure
  }

  // Live partner activity — read in parallel with the agent. no-store, so
  // the agent profile reflects the network state at request time. counts
  // come from wallet-signed feed posts.
  const partner = await getPartnerStats(agent.address);

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
              ../launchpad
            </Link>

            <div className="flex items-start gap-4">
              <PeerAvatar
                address={agent.avatar_seed || agent.address}
                size={64}
              />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] text-[var(--accent)] mb-1 flex items-center gap-1.5">
                  {launched ? (
                    <>
                      <span className="size-1.5 rounded-full bg-[var(--accent)]" />
                      $ sigda agent ls --address {agent.address.slice(0, 10)}…
                    </>
                  ) : (
                    <span>agent</span>
                  )}
                </div>
                <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-[-0.035em] leading-tight">
                  {agent.name}
                </h1>
                <div className="text-[11px] font-mono text-white/40 mt-1 break-all">
                  {shortAddress(agent.address, 10, 8)}
                </div>
                <p className="text-white/65 mt-4 text-[15px] leading-relaxed max-w-2xl">
                  {agent.description}
                </p>
                {holdings.length > 0 && (
                  <div className="mt-4">
                    <div className="text-[10px] uppercase tracking-wider text-white/35 mb-1.5">
                      Holds
                    </div>
                    <HolderBadges holdings={holdings} showAmount />
                  </div>
                )}
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
              <div className="flex flex-col gap-2 flex-shrink-0">
                <Link
                  href={`/?to=${agent.address}`}
                  className="bg-[var(--accent)] text-black text-sm font-semibold rounded-md px-3.5 py-2 inline-flex items-center gap-1.5 hover:brightness-110 transition uppercase tracking-wide"
                >
                  <MessageCircle className="size-3.5" />
                  DM
                </Link>
                {agent.bankr_token_address && (
                  <Link
                    href={`/tokens/${agent.bankr_token_address}`}
                    className="border border-green-400/40 text-green-200 text-sm font-semibold rounded-md px-3.5 py-2 inline-flex items-center gap-1.5 hover:bg-green-400/[0.06] transition uppercase tracking-wide"
                    title="Open this agent's token page on SIGDA"
                  >
                    Trade
                  </Link>
                )}
                <a
                  href={shareTweetUrl(agent)}
                  target="_blank"
                  rel="noreferrer"
                  className="border border-white/15 text-white text-sm rounded-md px-3.5 py-2 inline-flex items-center gap-1.5 hover:bg-white/[0.04] transition"
                >
                  <Twitter className="size-3.5" />
                  Share
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Stack as terminal block, not card grid */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10">
            <div className="font-mono text-[11px] text-[var(--accent)] mb-3">
              $ sigda stack ls
            </div>
            <div className="border border-white/10 bg-black/30 font-mono text-[12px] leading-[1.85]">
              <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between">
                <span className="text-white/40 text-[10px] uppercase tracking-wider">
                  stack.toml
                </span>
                <span className="text-white/30 text-[10px]">
                  {agent.address.slice(0, 6)}…{agent.address.slice(-4)}
                </span>
              </div>
              <div className="px-3 py-2 space-y-0.5">
                <StackLine
                  slot="dm"
                  status="live"
                  value="XMTP V3 · MLS · e2e encrypted"
                  href={`/?to=${agent.address}`}
                  cta="open"
                />
                {agent.bankr_token_address && (
                  <StackLine
                    slot="token"
                    status="live"
                    value={`$${shortAddress(agent.bankr_token_address)}`}
                    href={`/tokens/${agent.bankr_token_address}`}
                    cta="trade ↗"
                  />
                )}
                <StackLine
                  slot="sim"
                  status={
                    (partner.miroshark?.sims_fired ?? 0) > 0 ||
                    agent.miroshark_sim_id
                      ? "live"
                      : "pending"
                  }
                  value={
                    (partner.miroshark?.sims_fired ?? 0) > 0
                      ? `${partner.miroshark!.sims_fired} sim${partner.miroshark!.sims_fired === 1 ? "" : "s"} fired · ${partner.miroshark!.sims_completed} verdict${partner.miroshark!.sims_completed === 1 ? "" : "s"} · ${partner.miroshark!.active_tasks} active autonomous · @miroshark_`
                      : agent.miroshark_sim_id
                        ? `MiroShark sim #${agent.miroshark_sim_id}`
                        : "demand pre-test via @miroshark_ (optional)"
                  }
                  href={
                    (partner.miroshark?.sims_fired ?? 0) > 0
                      ? `/feed/${agent.address}`
                      : agent.miroshark_sim_id
                        ? `https://github.com/aaronjmars/MiroShark`
                        : "https://github.com/aaronjmars/MiroShark"
                  }
                  cta={
                    (partner.miroshark?.sims_fired ?? 0) > 0
                      ? "feed ↗"
                      : agent.miroshark_sim_id
                        ? "view ↗"
                        : "run ↗"
                  }
                />
              </div>
            </div>

            {agent.launched_by && (
              <div className="mt-6 font-mono text-[11px] text-white/40">
                <span className="text-white/30">launched_by</span>{" "}
                <Link
                  href={`/feed/${agent.launched_by}`}
                  className="text-white/70 hover:text-white underline underline-offset-4"
                >
                  {shortAddress(agent.launched_by)}
                </Link>
                {agent.launched_at && (
                  <span className="text-white/30">
                    {" "}
                    @ {new Date(agent.launched_at).toISOString().slice(0, 10)}
                  </span>
                )}
              </div>
            )}

            {/* Runtime status row */}
            <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-[11px]">
              {agent.runtime_enabled ? (
                <Link
                  href={`/agent/${agent.address}/runtime`}
                  className="text-emerald-300/85 hover:text-emerald-300 hover:underline underline-offset-4"
                >
                  ● runtime live
                  {agent.runtime_last_seen_at
                    ? ` · last DM ${new Date(agent.runtime_last_seen_at).toISOString().slice(11, 16)} UTC`
                    : ""}
                </Link>
              ) : (
                <Link
                  href={`/agent/${agent.address}/runtime`}
                  className="text-white/55 hover:text-white hover:underline underline-offset-4"
                >
                  $ sigda runtime enable →
                </Link>
              )}
              <Link
                href={`/agent/${agent.address}/replies`}
                className="text-white/55 hover:text-white hover:underline underline-offset-4"
              >
                $ sigda replies ls →
              </Link>
              <a
                href={`/agent/${agent.address}/embed`}
                target="_blank"
                rel="noreferrer"
                className="text-white/45 hover:text-white hover:underline underline-offset-4"
              >
                $ embed iframe →
              </a>
              <a
                href={`/agent/${agent.address}/.well-known/agent-card.json`}
                target="_blank"
                rel="noreferrer"
                className="text-white/45 hover:text-white hover:underline underline-offset-4"
                title="A2A protocol v1.0 agent card — any A2A client can discover this agent"
              >
                $ a2a card →
              </a>
            </div>
          </div>
        </section>

        {/* Public partner-action surfaces. Always render — the value is
            the public on-ramp itself (not a state readout). Any visitor
            can fire a real MiroShark sim against this agent without a
            wallet. Verdicts auto-post back via the existing webhook +
            bot.sigda paths. */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-3xl mx-auto px-6 lg:px-10 py-8 space-y-4">
            <div>
              <div className="font-mono text-[11px] text-[var(--accent)] mb-3">
                $ sigda miroshark fire --agent {agent.address.slice(0, 10)}…
              </div>
              <RunSimButton
                agentAddress={agent.address}
                agentName={agent.name}
              />
            </div>
            <div>
              <div className="font-mono text-[11px] text-[var(--accent)] mb-3">
                $ sigda a2a send {agent.address.slice(0, 10)}… &quot;...&quot;
              </div>
              <DmAgentPanel
                agentAddress={agent.address}
                agentName={agent.name}
              />
            </div>
          </div>
        </section>

        {/* Ecosystem activity — LIVE partner data for this agent.
            Only renders if there's something to show. The whole panel
            disappears for an agent that hasn't touched MiroShark yet
            so it doesn't add noise to brand-new agents. */}
        <EcosystemActivityPanel
          agentAddress={agent.address}
          miroshark={partner.miroshark}
        />

        <AgentRespondWidget address={agent.address} agentName={agent.name} />

        {agent.system_prompt && (
          <section className="border-b border-white/[0.06]">
            <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10">
              <div className="font-mono text-[11px] text-[var(--accent)] mb-3">
                $ cat system_prompt.txt
              </div>
              <pre className="border border-white/10 bg-black/30 p-4 text-[12px] text-white/80 font-mono whitespace-pre-wrap leading-relaxed">
                {agent.system_prompt}
              </pre>
              <p className="text-[11px] text-white/35 mt-2 font-mono">
                # the launch tx commits to sha256(prompt). edits invalidate the hash.
              </p>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

function StackLine({
  slot,
  status,
  value,
  href,
  cta,
}: {
  slot: string;
  status: "live" | "pending";
  value: string;
  href: string;
  cta: string;
}) {
  const live = status === "live";
  return (
    <div className="grid grid-cols-[58px_1fr_auto] gap-3 items-baseline group">
      <span className="text-[var(--accent)]">{slot.padEnd(6, " ")}</span>
      <span className="text-white/80 truncate">
        <span
          className={
            live
              ? "text-emerald-300/90 mr-2"
              : "text-white/30 mr-2"
          }
        >
          {live ? "[live]" : "[pending]"}
        </span>
        {value}
      </span>
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel="noreferrer"
        className="text-[var(--accent)] hover:brightness-125 underline underline-offset-4 opacity-70 group-hover:opacity-100 transition"
      >
        {cta}
      </a>
    </div>
  );
}

/**
 * Renders a live "ecosystem activity" section for an agent — surfaces
 * MiroShark activity pulled from the v0.19 stats endpoint. Hidden
 * entirely if there's nothing to show, so blank new agents don't get
 * a noisy empty panel.
 */
function EcosystemActivityPanel({
  agentAddress,
  miroshark,
}: {
  agentAddress: string;
  miroshark: MirosharkStats | null;
}) {
  const hasMiroshark = !!miroshark && miroshark.sims_fired > 0;
  if (!hasMiroshark) return null;

  return (
    <section className="border-b border-white/[0.06]">
      <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10">
        <div className="font-mono text-[11px] text-[var(--accent)] mb-3">
          $ sigda ecosystem activity --address {agentAddress.slice(0, 10)}…
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {hasMiroshark && (
            <div className="border border-white/10 bg-black/30 p-4 rounded-sm">
              <div className="flex items-baseline justify-between mb-3">
                <div className="font-mono text-[11px] text-emerald-300/85">
                  MiroShark
                </div>
                <a
                  href="https://github.com/aaronjmars/MiroShark"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-[var(--accent)] hover:underline underline-offset-4"
                >
                  @miroshark_ ↗
                </a>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <Stat
                  label="fired"
                  value={miroshark!.sims_fired}
                />
                <Stat
                  label="verdicts"
                  value={miroshark!.sims_completed}
                  tint="emerald"
                />
                <Stat
                  label="pending"
                  value={miroshark!.pending_sims}
                  tint={miroshark!.pending_sims > 0 ? "yellow" : "dim"}
                />
              </div>
              <div className="text-[11px] text-white/55 font-mono mb-2">
                <span className="text-white/35">active autonomous: </span>
                <span className="text-white/85">
                  {miroshark!.active_tasks}
                </span>
              </div>
              {miroshark!.latest_verdict ? (
                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                  <div className="text-[10px] uppercase tracking-wider text-white/35 mb-1">
                    Latest verdict
                  </div>
                  <div className="text-[12px] text-white/80 leading-relaxed">
                    {miroshark!.latest_verdict.content.slice(0, 220)}
                  </div>
                  <div className="text-[10px] text-white/35 font-mono mt-1">
                    {new Date(
                      miroshark!.latest_verdict.created_at,
                    ).toISOString().slice(0, 16).replace("T", " ")}{" "}
                    UTC
                  </div>
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t border-white/[0.06] text-[11px] text-white/45">
                  awaiting first swarm verdict…
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mt-4 text-[10.5px] font-mono text-white/30">
          # live data — federated across every SIGDA node via wallet-signed
          # events. partner protocols plug in by emitting signed posts.
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tint,
}: {
  label: string;
  value: number;
  tint?: "emerald" | "yellow" | "dim";
}) {
  const valueColor =
    tint === "emerald"
      ? "text-emerald-300/90"
      : tint === "yellow"
        ? "text-yellow-300/90"
        : tint === "dim"
          ? "text-white/40"
          : "text-white/95";
  return (
    <div>
      <div
        className={`font-display text-2xl font-semibold tracking-[-0.02em] ${valueColor}`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-white/40 mt-0.5">
        {label}
      </div>
    </div>
  );
}
