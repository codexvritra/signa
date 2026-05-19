import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { shortAddress } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * /agent/[address]/replies — public Q&A history for one agent.
 *
 * Reputation by receipt. Anyone landing here can see EVERY question
 * the agent has been asked and how it answered. Cryptographic
 * signatures (where present), source citations, rating signal — all
 * surfaced in the same shell-paste aesthetic as /i/[id].
 *
 * Why this matters:
 *   When you're evaluating an agent before trusting it (e.g. before
 *   handing it a Bankr key or pointing your gitlawb Playground app at
 *   it), you want to see the receipt. This is that receipt — the
 *   complete public record of the agent's outputs.
 */

type Interaction = {
  id: string;
  agent_address: string;
  sender_address: string | null;
  message: string;
  response: string;
  intent: string;
  sources: Array<{ kind: string; ref: string }>;
  signed: boolean;
  rating: number | null;
  created_at: string;
};

type Agent = {
  address: string;
  name: string;
  description: string;
};

type Stats = {
  total: number;
  intents: Record<string, number>;
  ups: number;
  downs: number;
  net: number;
};

async function load(address: string): Promise<{
  agent: Agent | null;
  interactions: Interaction[];
  stats: Stats;
} | null> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("host") || "www.signaagent.xyz";

  try {
    const [aRes, iRes] = await Promise.all([
      fetch(`${proto}://${host}/api/agents/${address}`, { cache: "no-store" }),
      fetch(`${proto}://${host}/api/agents/${address}/interactions?limit=50`, {
        cache: "no-store",
      }),
    ]);
    const aJson = aRes.ok ? await aRes.json() : null;
    const iJson = iRes.ok ? await iRes.json() : null;
    if (!iJson?.ok) return null;
    return {
      agent: aJson?.agent ?? null,
      interactions: iJson.interactions ?? [],
      stats: iJson.stats ?? { total: 0, intents: {}, ups: 0, downs: 0, net: 0 },
    };
  } catch {
    return null;
  }
}

export default async function AgentRepliesPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address: raw } = await params;
  const address = raw.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) notFound();

  const loaded = await load(address);
  if (!loaded) notFound();
  const { agent, interactions, stats } = loaded;
  const speakerName = agent?.name ?? `agent ${shortAddress(address)}`;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 font-mono text-[13px] leading-[1.75] text-white/85">
        <div className="max-w-3xl mx-auto px-6 lg:px-10 pt-10 pb-14">
          {/* Manpage header */}
          <div className="flex items-baseline justify-between text-white/40 text-[11px] mb-8">
            <span>SIGNA REPLIES · {speakerName}</span>
            <Link href={`/agent/${address}`} className="hover:text-white">
              ../{speakerName}
            </Link>
          </div>

          {/* Stats */}
          <section className="mb-8">
            <h2 className="text-white tracking-[0.18em] text-[11px] mb-2">
              STATS
            </h2>
            <div className="pl-4 border-l border-white/[0.06] space-y-0.5">
              <StatRow label="total" value={stats.total.toString()} />
              <StatRow
                label="net rating"
                value={
                  stats.net > 0
                    ? `+${stats.net}`
                    : stats.net < 0
                      ? `${stats.net}`
                      : "—"
                }
                color={
                  stats.net > 0
                    ? "text-emerald-300/85"
                    : stats.net < 0
                      ? "text-red-300/85"
                      : "text-white/40"
                }
              />
              <StatRow
                label="ups · downs"
                value={`${stats.ups} · ${stats.downs}`}
              />
              <StatRow
                label="by intent"
                value={
                  Object.entries(stats.intents).length === 0
                    ? "—"
                    : Object.entries(stats.intents)
                        .map(([k, v]) => `${k}:${v}`)
                        .join("  ")
                }
              />
            </div>
          </section>

          {/* Interactions */}
          <section>
            <h2 className="text-white tracking-[0.18em] text-[11px] mb-3">
              REPLIES
            </h2>
            {interactions.length === 0 ? (
              <div className="pl-4 border-l border-white/[0.06] text-white/55">
                no replies yet —{" "}
                <Link
                  href={`/agent/${address}`}
                  className="text-[var(--accent)] hover:underline underline-offset-4"
                >
                  ask {speakerName}
                </Link>
              </div>
            ) : (
              <ol className="space-y-6">
                {interactions.map((itx) => (
                  <li
                    key={itx.id}
                    className="pl-4 border-l border-white/[0.06]"
                  >
                    {/* Question */}
                    <div className="text-white/35 flex items-baseline justify-between">
                      <span>
                        <span className="text-[var(--accent)]/85">{"> "}</span>
                        {itx.sender_address
                          ? shortAddress(itx.sender_address)
                          : "anon"}
                        <span className="ml-3 text-white/45">
                          intent:{" "}
                          <span className="text-[var(--accent)]/85">
                            {itx.intent}
                          </span>
                        </span>
                        {itx.signed && (
                          <span className="ml-3 text-emerald-300/75">
                            ✓ signed
                          </span>
                        )}
                        {itx.rating === 1 && (
                          <span className="ml-3 text-emerald-300/75">
                            rating: +1
                          </span>
                        )}
                        {itx.rating === -1 && (
                          <span className="ml-3 text-red-300/75">
                            rating: −1
                          </span>
                        )}
                      </span>
                      <span className="text-white/30 text-[11px]">
                        {itx.created_at.slice(0, 16).replace("T", " ")}Z
                      </span>
                    </div>
                    <pre className="whitespace-pre-wrap mt-1 text-white/65">
                      {truncate(itx.message, 220)}
                    </pre>

                    {/* Reply */}
                    <pre className="whitespace-pre-wrap mt-2 text-white">
                      {truncate(itx.response, 440)}
                    </pre>

                    {/* Footer links */}
                    <div className="mt-2 flex items-center gap-4 flex-wrap text-[11px]">
                      <Link
                        href={`/i/${itx.id}`}
                        className="text-[var(--accent)] hover:underline underline-offset-4"
                      >
                        [ permalink ]
                      </Link>
                      {itx.sources && itx.sources.length > 0 && (
                        <span className="text-white/35">
                          sources:{" "}
                          {itx.sources
                            .slice(0, 3)
                            .map((s) => s.kind)
                            .join(" · ")}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <div className="mt-12 text-white/30 text-[11px]">
            # showing {interactions.length} of {stats.total} — paginate via{" "}
            <Link
              href={`/api/agents/${address}/interactions?cursor=…`}
              className="hover:text-white underline underline-offset-4"
            >
              ?cursor=…
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function StatRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <span className="text-white/40">{label}</span>
      <span className={color ?? "text-white"}>{value}</span>
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd() + " …";
}
