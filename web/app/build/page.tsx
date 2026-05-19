import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { BuildForm } from "./BuildForm";
import { serverClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "build · signa",
  description:
    "One-click gitlawb Playground app pre-wired to any signa-launched AI agent. Ship a wallet-signed AI dapp in under a minute.",
};

type LaunchableAgent = {
  address: string;
  name: string;
  description: string;
  tags: string[] | null;
  gitlawb_did: string | null;
};

async function getAgents(): Promise<LaunchableAgent[]> {
  const db = serverClient();
  const { data } = await db
    .from("agents")
    .select("address, name, description, tags, gitlawb_did")
    .is("deleted_at", null)
    .not("launched_at", "is", null)
    .order("launched_at", { ascending: false })
    .limit(30);
  return (data ?? []) as LaunchableAgent[];
}

/**
 * /build — one-click gitlawb Playground app launcher pre-wired to a
 * SIGNA agent.
 *
 * Why this exists:
 *
 *   Anyone who wants to ship a small AI dapp on the gitlawb Playground
 *   normally has to (a) generate a prompt, (b) wire up an LLM provider,
 *   (c) figure out auth, (d) hope it works. signa's deal:
 *
 *     paste idea → pick an agent → click → playground opens with the
 *     prompt + a real, wallet-signed, no-auth /respond endpoint already
 *     wired in. zero AI infra on the builder's side.
 *
 *   This is the gitlawb Playground contest unlock — every contest
 *   entry that uses signa for the AI half ships faster and looks more
 *   serious (wallet-signed replies, cited sources, agent identity).
 *
 * Page is server-rendered with the agent list; the form (client) builds
 * the deep-link locally — no extra round-trip.
 */
export default async function BuildPage() {
  const agents = await getAgents();
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 font-mono text-[13px] leading-[1.75] text-white/85">
        <div className="max-w-3xl mx-auto px-6 lg:px-10 pt-10 pb-14">
          <div className="flex items-baseline justify-between text-white/40 text-[11px] mb-8">
            <span>SIGNA-BUILD(1)</span>
            <a
              href="https://playground.gitlawb.app"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              playground.gitlawb.app ↗
            </a>
          </div>

          <section className="mb-6">
            <h2 className="text-white tracking-[0.18em] text-[11px] mb-2">
              NAME
            </h2>
            <div className="pl-4 border-l border-white/[0.06]">
              signa-build — spawn a gitlawb Playground app pre-wired to a
              signa agent
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-white tracking-[0.18em] text-[11px] mb-2">
              DESCRIPTION
            </h2>
            <div className="pl-4 border-l border-white/[0.06] text-white/65">
              describe an app. pick a signa agent. click. the gitlawb
              Playground opens with the prompt + the agent&apos;s
              /respond endpoint context already embedded — so the
              generated app has a working wallet-signed AI backend on
              the first try. no api keys, no llm provider, no auth setup.
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-white tracking-[0.18em] text-[11px] mb-2">
              WHAT YOU GET
            </h2>
            <table className="pl-4 border-l border-white/[0.06] w-full border-collapse">
              <tbody>
                {(
                  [
                    [
                      "ai backend",
                      "POST signaagent.xyz/api/agents/{addr}/respond",
                      "no auth, no key, no rate-limit",
                    ],
                    [
                      "signed replies",
                      "EIP-191 personal_sign per reply",
                      "verifiable in-browser at /verify",
                    ],
                    [
                      "sources",
                      "every reply cites partners",
                      "geckoterminal, gitlawb, bankr, miroshark",
                    ],
                    [
                      "iframe drop-in",
                      "<iframe src='.../embed' />",
                      "skip the wiring entirely",
                    ],
                  ] as Array<[string, string, string]>
                ).map(([k, v, hint]) => (
                  <tr key={k} className="align-top">
                    <td className="text-[var(--accent)]/85 pr-3 py-0.5 whitespace-nowrap w-[120px]">
                      {k}
                    </td>
                    <td className="text-white py-0.5 pr-3 whitespace-nowrap">
                      {v}
                    </td>
                    <td className="text-white/40 py-0.5">{hint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <BuildForm agents={agents} />

          <section className="mt-10">
            <h2 className="text-white tracking-[0.18em] text-[11px] mb-2">
              SEE ALSO
            </h2>
            <div className="pl-4 border-l border-white/[0.06] text-white/55">
              gitlawb Playground contest: cash prizes for the best
              single-HTML apps shipped to *.gitlawb.app. signa makes
              the AI half free + cryptographically verifiable.
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
