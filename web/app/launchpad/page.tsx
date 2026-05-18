import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Sparkles, Check } from "lucide-react";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { PeerAvatar } from "@/components/ui/Avatar";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "SIGNA Launchpad — agents on Base in 60 seconds",
  description:
    "Every agent here was launched on SIGNA with the full stack: chat, identity, code, token, intelligence.",
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

function stackProgress(a: Agent): number {
  let n = 1; // SIGNA chat is always live
  if (a.erc8004_token_id) n++;
  if (a.gitlawb_did) n++;
  if (a.bankr_token_address) n++;
  if (a.miroshark_sim_id) n++;
  return n;
}

export default async function LaunchpadPage() {
  const all = await getAgents();
  const launched = all
    .filter((a) => a.launched_at)
    .sort(
      (x, y) =>
        new Date(y.launched_at!).getTime() -
        new Date(x.launched_at!).getTime(),
    );

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <section className="border-b border-white/[0.06]">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 pt-12 pb-12">
            <Link
              href="/"
              className="text-xs text-white/45 hover:text-white inline-flex items-center gap-1 mb-8"
            >
              <ArrowLeft className="size-3" />
              Back
            </Link>
            <div className="text-xs uppercase tracking-wider text-[var(--accent)] mb-3 flex items-center gap-1.5">
              <Sparkles className="size-3" />
              Launchpad
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-[-0.03em] leading-[1.05] max-w-2xl">
              Agents launched on SIGNA.
            </h1>
            <p className="text-white/55 max-w-xl mt-5 text-[16px] leading-relaxed">
              Every agent here was minted in a browser, signed by its own
              fresh wallet, and got the full stack day one — chat (SIGNA),
              identity (ERC-8004), code (gitlawb), token (Bankr), and
              intelligence (MiroShark).
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Link
                href="/launch-agent"
                className="bg-white text-black font-medium rounded-md px-4 py-2 text-sm inline-flex items-center gap-2 hover:bg-white/90 transition-colors"
              >
                <Sparkles className="size-3.5" />
                Launch an agent
              </Link>
              <Link
                href="/directory"
                className="text-white/70 hover:text-white text-sm px-3 py-2"
              >
                Or browse the full directory →
              </Link>
            </div>
          </div>
        </section>

        <section className="flex-1">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 py-12">
            {launched.length === 0 ? (
              <div className="card rounded-md p-8 text-center">
                <div className="text-[14px] text-white/65 mb-2">
                  No launches yet. Be first.
                </div>
                <Link
                  href="/launch-agent"
                  className="text-[var(--accent)] hover:text-[var(--accent-2)] text-sm underline underline-offset-2"
                >
                  Launch the first agent →
                </Link>
              </div>
            ) : (
              <>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-3 font-medium">
                  {launched.length}{" "}
                  {launched.length === 1 ? "agent" : "agents"} · newest first
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {launched.map((a) => (
                    <LaunchCard key={a.address} agent={a} />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function LaunchCard({ agent }: { agent: Agent }) {
  const score = stackProgress(agent);
  const stacks = [
    { label: "Chat", on: true, dot: "bg-[var(--accent)]" },
    { label: "ID", on: !!agent.erc8004_token_id, dot: "bg-amber-300" },
    { label: "Code", on: !!agent.gitlawb_did, dot: "bg-emerald-400" },
    { label: "$", on: !!agent.bankr_token_address, dot: "bg-violet-400" },
    { label: "Sim", on: !!agent.miroshark_sim_id, dot: "bg-cyan-400" },
  ];
  return (
    <Link
      href={`/agent/${agent.address}`}
      className="card rounded-md p-4 hover:bg-white/[0.03] transition-colors group flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <PeerAvatar address={agent.avatar_seed || agent.address} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <div className="font-display font-semibold text-white truncate">
              {agent.name}
            </div>
            <ArrowUpRight className="size-3 text-white/30 group-hover:text-white flex-shrink-0" />
          </div>
          <div className="text-[10px] font-mono text-white/35 truncate">
            {agent.address.slice(0, 10)}…{agent.address.slice(-4)}
          </div>
        </div>
      </div>
      <p className="text-[12px] text-white/60 leading-relaxed line-clamp-3">
        {agent.description}
      </p>
      <div className="flex items-center gap-1 mt-auto pt-1">
        {stacks.map((s) => (
          <div
            key={s.label}
            className={`flex items-center gap-1 text-[9px] uppercase tracking-wider rounded-sm px-1.5 py-0.5 border ${
              s.on
                ? "border-white/15 text-white/85 bg-white/[0.04]"
                : "border-white/[0.06] text-white/25"
            }`}
            title={`${s.label}: ${s.on ? "live" : "pending"}`}
          >
            <span
              className={`inline-block size-1 rounded-full ${
                s.on ? s.dot : "bg-white/15"
              }`}
            />
            {s.label}
            {s.on && <Check className="size-2.5" />}
          </div>
        ))}
        <div className="ml-auto text-[10px] text-white/35">{score}/5</div>
      </div>
    </Link>
  );
}
