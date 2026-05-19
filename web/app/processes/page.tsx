import Link from "next/link";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { serverClient } from "@/lib/supabase";
import { shortAddress } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ps aux · signa",
  description:
    "Every live agent on the signa decentralized OS — uptime, last syscall, runtime status.",
};

/**
 * /processes — public 'ps aux' for the signa decentralized OS.
 *
 * Each row is one agent process. Columns mirror the unix `ps` output:
 *
 *   PID     short hash of agent address
 *   USER    launched_by (owner wallet)
 *   STAT    R = runtime live · S = sleeping (no runtime)
 *   UPTIME  since launched_at
 *   CPU%    proxy = N interactions in last 24h
 *   MEM     interaction count (proxy for memory footprint)
 *   CMD     the agent's name + last activity
 *
 * This is the most concrete expression of the 'decentralized OS'
 * metaphor in the product. Anyone landing here sees signa as what
 * it actually is: a process scheduler for AI agents.
 */

type Agent = {
  address: string;
  name: string;
  description: string;
  tags: string[] | null;
  launched_at: string | null;
  launched_by: string | null;
  runtime_enabled: boolean | null;
  runtime_last_seen_at: string | null;
  gitlawb_did: string | null;
  erc8004_token_id: string | null;
  bankr_token_address: string | null;
};

type ProcessRow = {
  agent: Agent;
  uptime: string;
  totalCalls: number;
  callsLast24h: number;
  callsLastHour: number;
  lastIntent: string | null;
  lastSeen: string | null;
};

function fmtUptime(launchedAt: string | null): string {
  if (!launchedAt) return "—";
  const ageMs = Date.now() - new Date(launchedAt).getTime();
  const s = Math.floor(ageMs / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h${(m % 60).toString().padStart(2, "0")}`;
  const d = Math.floor(h / 24);
  return `${d}d${(h % 24).toString().padStart(2, "0")}h`;
}

async function loadProcesses(): Promise<ProcessRow[]> {
  const db = serverClient();
  const { data: agents } = await db
    .from("agents")
    .select(
      "address, name, description, tags, launched_at, launched_by, runtime_enabled, runtime_last_seen_at, gitlawb_did, erc8004_token_id, bankr_token_address",
    )
    .is("deleted_at", null)
    .not("launched_at", "is", null)
    .order("launched_at", { ascending: false });

  if (!agents || agents.length === 0) return [];

  // Aggregate interaction stats per agent in a single query.
  const { data: interactions } = await db
    .from("agent_interactions")
    .select("agent_address, created_at, intent");

  const dayMs = 86_400_000;
  const hourMs = 3_600_000;
  const now = Date.now();

  const byAgent = new Map<string, ProcessRow>();
  for (const a of agents) {
    byAgent.set(a.address.toLowerCase(), {
      agent: a as Agent,
      uptime: fmtUptime(a.launched_at),
      totalCalls: 0,
      callsLast24h: 0,
      callsLastHour: 0,
      lastIntent: null,
      lastSeen: null,
    });
  }

  for (const i of interactions ?? []) {
    const row = byAgent.get((i.agent_address ?? "").toLowerCase());
    if (!row) continue;
    row.totalCalls++;
    const t = new Date(i.created_at).getTime();
    if (now - t < dayMs) row.callsLast24h++;
    if (now - t < hourMs) row.callsLastHour++;
    if (!row.lastSeen || row.lastSeen < i.created_at) {
      row.lastSeen = i.created_at;
      row.lastIntent = i.intent;
    }
  }

  return Array.from(byAgent.values()).sort((a, b) => {
    // Sort: runtime-live agents first, then by recent activity desc.
    const ra = a.agent.runtime_enabled ? 1 : 0;
    const rb = b.agent.runtime_enabled ? 1 : 0;
    if (rb !== ra) return rb - ra;
    return b.callsLast24h - a.callsLast24h;
  });
}

export default async function ProcessesPage() {
  const procs = await loadProcesses();

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 font-mono text-[13px] leading-[1.75] text-white/85">
        <div className="max-w-4xl mx-auto px-6 lg:px-10 pt-10 pb-14">
          <div className="flex items-baseline justify-between text-white/40 text-[11px] mb-8">
            <span>SIGNA-PS(1)</span>
            <Link href="/" className="hover:text-white">
              ..
            </Link>
          </div>

          <section className="mb-6">
            <h2 className="text-white tracking-[0.18em] text-[11px] mb-2">
              NAME
            </h2>
            <div className="pl-4 border-l border-white/[0.06]">
              signa-ps — list every agent process on the decentralized OS
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-white tracking-[0.18em] text-[11px] mb-2">
              SYNOPSIS
            </h2>
            <div className="pl-4 border-l border-white/[0.06] text-white/65">
              ps -ef on the signa cluster. each row = one launched agent =
              one base-mainnet wallet running an xmtp inbox + a public
              /respond syscall. STAT R means a runtime is consuming the
              custody vault (signed replies); S means non-custodial.
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-white tracking-[0.18em] text-[11px] mb-3">
              PROCESSES · {procs.length}
            </h2>
            {procs.length === 0 ? (
              <div className="pl-4 border-l border-white/[0.06] text-white/55">
                no agent processes spawned yet.{" "}
                <Link
                  href="/launch-agent"
                  className="text-[var(--accent)] hover:underline underline-offset-4"
                >
                  /launch-agent
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="text-white/35 tracking-[0.15em] text-[10px]">
                      <th className="text-left pr-3 py-1 font-normal">PID</th>
                      <th className="text-left pr-3 py-1 font-normal">USER</th>
                      <th className="text-left pr-3 py-1 font-normal">STAT</th>
                      <th className="text-left pr-3 py-1 font-normal">UPTIME</th>
                      <th className="text-right pr-3 py-1 font-normal">1H</th>
                      <th className="text-right pr-3 py-1 font-normal">24H</th>
                      <th className="text-right pr-3 py-1 font-normal">TOTAL</th>
                      <th className="text-left py-1 font-normal">CMD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {procs.map((p) => (
                      <Row key={p.agent.address} p={p} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-white tracking-[0.18em] text-[11px] mb-2">
              LEGEND
            </h2>
            <div className="pl-4 border-l border-white/[0.06] space-y-0.5 text-white/55 text-[12px]">
              <div>
                <span className="text-emerald-300/85">R</span>{" "}
                runtime-live · agent&apos;s private key in vault · replies signed
              </div>
              <div>
                <span className="text-white/45">S</span> sleeping ·
                non-custodial · replies unsigned (caller verifies via /verify)
              </div>
              <div>
                <span className="text-[var(--accent)]/85">1H / 24H / TOTAL</span>{" "}
                = interactions counted in the agent_interactions table
              </div>
              <div>
                <span className="text-[var(--accent)]/85">CMD</span> shows last
                syscall intent (facts / code / swarm / action / chat / error)
              </div>
            </div>
          </section>

          <div className="mt-12 text-white/30 text-[11px]">
            # public api:{" "}
            <Link
              href="/api/agents"
              className="hover:text-white underline underline-offset-4"
            >
              /api/agents
            </Link>{" "}
            ·{" "}
            <Link
              href="/api/stats"
              className="hover:text-white underline underline-offset-4"
            >
              /api/stats
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Row({ p }: { p: ProcessRow }) {
  const a = p.agent;
  const stat = a.runtime_enabled ? "R" : "S";
  const statColor = a.runtime_enabled
    ? "text-emerald-300/85"
    : "text-white/45";
  const user = a.launched_by
    ? shortAddress(a.launched_by, 6, 4)
    : "—";

  return (
    <tr className="hover:bg-white/[0.02] align-baseline">
      <td className="pr-3 py-1.5 text-white/55 tabular-nums">
        <Link
          href={`/agent/${a.address}`}
          className="hover:text-white hover:underline underline-offset-4"
        >
          {a.address.slice(2, 8)}
        </Link>
      </td>
      <td className="pr-3 py-1.5 text-white/55">{user}</td>
      <td className={`pr-3 py-1.5 ${statColor}`}>{stat}</td>
      <td className="pr-3 py-1.5 text-white/65 tabular-nums">{p.uptime}</td>
      <td className="pr-3 py-1.5 text-right tabular-nums">
        {p.callsLastHour > 0 ? (
          <span className="text-emerald-300/85">{p.callsLastHour}</span>
        ) : (
          <span className="text-white/25">0</span>
        )}
      </td>
      <td className="pr-3 py-1.5 text-right tabular-nums text-white/70">
        {p.callsLast24h}
      </td>
      <td className="pr-3 py-1.5 text-right tabular-nums text-white">
        {p.totalCalls}
      </td>
      <td className="py-1.5">
        <Link
          href={`/agent/${a.address}`}
          className="text-white hover:underline underline-offset-4"
        >
          {a.name}
        </Link>
        {p.lastIntent && (
          <span className="text-white/40 ml-2">
            · last: {p.lastIntent}
          </span>
        )}
      </td>
    </tr>
  );
}
