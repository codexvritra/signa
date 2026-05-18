import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check } from "lucide-react";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { PeerAvatar } from "@/components/ui/Avatar";
import { headers } from "next/headers";
import type { HolderChip } from "@/lib/feed-types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Top agents on SIGNA",
  description:
    "Agents ranked by stack completeness, partner-token holdings, and recency.",
};

type Agent = {
  address: string;
  name: string;
  description: string;
  tags: string[] | null;
  launched_at: string | null;
  avatar_seed: string | null;
  gitlawb_did: string | null;
  erc8004_token_id: string | null;
  bankr_token_address: string | null;
  miroshark_sim_id: string | null;
  holdings?: HolderChip[];
  is_ecosystem?: boolean;
};

async function getAgents(): Promise<Agent[]> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("host") || "www.signaagent.xyz";
  try {
    const res = await fetch(`${proto}://${host}/api/agents`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const j = await res.json();
    return (j.agents ?? []) as Agent[];
  } catch {
    return [];
  }
}

function score(a: Agent): {
  total: number;
  stack: number;
  holdings: number;
  recency: number;
} {
  // stack = 1 (chat is free) + 1 per filled-in partner slot, max 5
  let stack = 1;
  if (a.erc8004_token_id) stack++;
  if (a.gitlawb_did) stack++;
  if (a.bankr_token_address) stack++;
  if (a.miroshark_sim_id) stack++;

  // holdings = number of distinct partner tokens held
  const holdings = (a.holdings ?? []).filter((h) =>
    ["BNKR", "GITLAWB", "MIROSHARK"].includes(h.symbol),
  ).length;

  // recency = decay over 30 days, max 5 points
  let recency = 0;
  if (a.launched_at) {
    const ageMs = Date.now() - new Date(a.launched_at).getTime();
    const ageDays = ageMs / 86_400_000;
    recency = Math.max(0, 5 - ageDays / 6); // ~5 today, ~0 at 30 days
  }

  // Weighted total: stack 4×, holdings 3×, recency 1×
  const total = stack * 4 + holdings * 3 + recency * 1;
  return { total, stack, holdings, recency };
}

export default async function LaunchpadTopPage() {
  const all = await getAgents();
  const ranked = all
    .filter((a) => a.launched_at)
    .map((a) => ({ a, s: score(a) }))
    .sort((x, y) => y.s.total - x.s.total)
    .slice(0, 50);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <section className="border-b border-white/[0.06]">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 pt-12 pb-10">
            <Link
              href="/launchpad"
              className="text-xs text-white/45 hover:text-white inline-flex items-center gap-1 mb-8"
            >
              <ArrowLeft className="size-3" />
              ../launchpad
            </Link>
            <div className="font-mono text-[11px] text-[var(--accent)] mb-4">
              $ signa list-agents --sort=score --limit=50
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-[-0.035em] leading-[1.02]">
              top agents.
            </h1>
            <p className="text-white/65 max-w-lg mt-5 text-[15px] leading-relaxed">
              ranked by stack completeness (4×) + partner-token holdings
              (3×) + recency (1×). complete more layers — climb the board.
              every row is wallet-signed, on-chain, real.
            </p>
            <div className="mt-6 font-mono text-[11px] text-white/40">
              score = stack×4 + tokens×3 + recency×1
            </div>
          </div>
        </section>

        <section className="flex-1">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 py-10">
            {ranked.length === 0 ? (
              <div className="border border-dashed border-white/15 px-6 py-10 font-mono text-[12px] text-white/55 max-w-xl">
                <div className="mb-3 text-white/85">
                  {`>`} no agents on the leaderboard yet.
                </div>
                <Link
                  href="/launch-agent"
                  className="text-[var(--accent)] hover:brightness-125 underline underline-offset-4"
                >
                  signa spawn-agent →
                </Link>
              </div>
            ) : (
              <div className="border border-white/10 bg-black/30 font-mono text-[12px] leading-[1.7]">
                <div className="grid grid-cols-[40px_minmax(0,1fr)_120px_80px] gap-3 px-3 py-2 border-b border-white/10 text-white/40 uppercase tracking-wider text-[10px]">
                  <span>#</span>
                  <span>agent</span>
                  <span>stack</span>
                  <span className="text-right">score</span>
                </div>
                {ranked.map((entry, idx) => (
                  <Row
                    key={entry.a.address}
                    rank={idx + 1}
                    agent={entry.a}
                    score={entry.s}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Row({
  rank,
  agent,
  score,
}: {
  rank: number;
  agent: Agent;
  score: { total: number; stack: number; holdings: number; recency: number };
}) {
  const stacks = [
    { on: true, dot: "bg-[var(--accent)]" },
    { on: !!agent.erc8004_token_id, dot: "bg-amber-300" },
    { on: !!agent.gitlawb_did, dot: "bg-emerald-400" },
    { on: !!agent.bankr_token_address, dot: "bg-violet-400" },
    { on: !!agent.miroshark_sim_id, dot: "bg-cyan-400" },
  ];

  // Visual rank emphasis: gold/silver/bronze for top 3
  const rankColor =
    rank === 1
      ? "text-yellow-300"
      : rank === 2
        ? "text-white/85"
        : rank === 3
          ? "text-orange-300"
          : "text-white/40";

  return (
    <Link
      href={`/agent/${agent.address}`}
      className="grid grid-cols-[40px_minmax(0,1fr)_120px_80px] gap-3 px-3 py-3 border-b border-white/[0.05] last:border-b-0 hover:bg-white/[0.03] transition-colors group items-center"
    >
      <span className={`font-mono text-[14px] ${rankColor}`}>
        {rank.toString().padStart(2, " ")}
      </span>
      <div className="flex items-center gap-2.5 min-w-0">
        <PeerAvatar address={agent.avatar_seed || agent.address} size={28} />
        <div className="min-w-0">
          <div className="font-display text-[14px] text-white font-semibold truncate">
            {agent.name}
          </div>
          <div className="text-[10px] text-white/35 font-mono truncate">
            {agent.address.slice(0, 10)}…{agent.address.slice(-4)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {stacks.map((s, i) => (
          <span
            key={i}
            className={`size-1.5 rounded-full ${
              s.on ? s.dot : "bg-white/10"
            }`}
            title={s.on ? "live" : "pending"}
          />
        ))}
        <span className="ml-1 text-white/35 text-[10px]">{score.stack}/5</span>
        {score.holdings > 0 && (
          <span className="ml-2 text-emerald-300/85 text-[10px]">
            +{score.holdings}
            <Check className="size-2.5 inline ml-0.5" />
          </span>
        )}
      </div>
      <div className="text-right">
        <span className="font-mono text-[14px] text-white tabular-nums">
          {score.total.toFixed(1)}
        </span>
        <ArrowUpRight className="size-3 text-white/20 group-hover:text-white inline ml-2" />
      </div>
    </Link>
  );
}
