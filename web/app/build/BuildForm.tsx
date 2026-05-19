"use client";

import { useMemo, useState } from "react";

type LaunchableAgent = {
  address: string;
  name: string;
  description: string;
  tags: string[] | null;
  gitlawb_did: string | null;
};

const PRESET_IDEAS: Array<{ label: string; prompt: string }> = [
  {
    label: "base trending dashboard",
    prompt:
      "single-html dashboard showing the top 10 trending tokens on Base. live prices, 24h change, sparkline chart for each.",
  },
  {
    label: "agent chat embed",
    prompt:
      "single-html page that lets visitors chat with a SIGNA agent. textarea + reply pane, no other chrome.",
  },
  {
    label: "wallet portfolio viewer",
    prompt:
      "paste a 0x address, see the wallet's base-mainnet token balances + total USD value. uses the SIGNA agent for natural-language summary.",
  },
  {
    label: "token launch alerter",
    prompt:
      "single-html page that lists tokens launched on Base in the last hour via bankr's /token-launches. auto-refresh every 30s.",
  },
];

/**
 * Builds the gitlawb Playground deep-link with prompt + agent context
 * pre-filled. Client-side only — no extra round-trip. The Playground
 * accepts `?prompt=…` and renders the prompt directly into its
 * code-generation flow.
 */
function buildUrl(args: {
  idea: string;
  agent: LaunchableAgent | null;
}): string {
  const base = "https://playground.gitlawb.app/?prompt=";
  const ctx: string[] = [args.idea];
  if (args.agent) {
    ctx.push("");
    ctx.push("=== AI BACKEND ===");
    ctx.push(
      `This app talks to SIGNA agent "${args.agent.name}" — a free, CORS-open, wallet-signed AI reply endpoint.`,
    );
    ctx.push(
      `Endpoint: POST https://www.signaagent.xyz/api/agents/${args.agent.address}/respond`,
    );
    ctx.push(`Body: { "message": "user input here" }`);
    ctx.push(
      `Returns: { "ok": true, "response": "...", "intent": "...", "sources": [...], "signed": true|false, "signature": "...", "interaction_id": "..." }`,
    );
    ctx.push("");
    ctx.push("=== USAGE ===");
    ctx.push(
      "Call fetch() directly — no auth header, no api key, no CORS issues. Render the response in the page.",
    );
    if (args.agent.gitlawb_did) {
      ctx.push(`Agent's gitlawb DID: ${args.agent.gitlawb_did}`);
    }
    ctx.push(
      `Or skip the wiring and drop in an iframe: <iframe src="https://www.signaagent.xyz/agent/${args.agent.address}/embed" width="640" height="520"></iframe>`,
    );
  }
  return base + encodeURIComponent(ctx.join("\n").slice(0, 1800));
}

export function BuildForm({ agents }: { agents: LaunchableAgent[] }) {
  const [idea, setIdea] = useState("");
  const [agentAddr, setAgentAddr] = useState(agents[0]?.address ?? "");
  const selectedAgent = useMemo(
    () => agents.find((a) => a.address === agentAddr) ?? null,
    [agents, agentAddr],
  );
  const playgroundUrl = useMemo(
    () => buildUrl({ idea, agent: selectedAgent }),
    [idea, selectedAgent],
  );

  return (
    <section className="mb-6">
      <h2 className="text-white tracking-[0.18em] text-[11px] mb-3">
        BUILD
      </h2>
      <div className="pl-4 border-l border-white/[0.06] space-y-4">
        {/* Preset ideas */}
        <div>
          <div className="text-white/40 mb-1">presets</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {PRESET_IDEAS.map((p) => (
              <button
                key={p.label}
                onClick={() => setIdea(p.prompt)}
                className="text-[var(--accent)]/85 hover:text-[var(--accent)] hover:underline underline-offset-4"
              >
                /{p.label.replace(/\s+/g, "-")}
              </button>
            ))}
          </div>
        </div>

        {/* Idea */}
        <label className="block">
          <div className="text-white/40 mb-1">idea</div>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="describe the app — one paragraph is enough"
            rows={4}
            maxLength={1500}
            spellCheck={false}
            className="w-full bg-transparent outline-none text-white placeholder:text-white/25 border-l-2 border-white/15 focus:border-[var(--accent)] pl-3 py-1 resize-y"
          />
        </label>

        {/* Agent picker */}
        <label className="block">
          <div className="text-white/40 mb-1">
            ai backend agent
            <span className="text-white/30 ml-2">
              (the /respond endpoint your app will call)
            </span>
          </div>
          {agents.length === 0 ? (
            <div className="text-white/45 pl-3">
              no agents launched yet — visit /launch-agent first.
            </div>
          ) : (
            <select
              value={agentAddr}
              onChange={(e) => setAgentAddr(e.target.value)}
              className="w-full bg-black border-l-2 border-white/15 focus:border-[var(--accent)] pl-3 py-1 text-white outline-none"
            >
              {agents.map((a) => (
                <option key={a.address} value={a.address}>
                  {a.name} · {a.address.slice(0, 8)}…{a.address.slice(-4)}
                </option>
              ))}
            </select>
          )}
        </label>

        {/* Submit */}
        <div className="flex items-center gap-4 flex-wrap">
          <a
            href={idea.trim() && selectedAgent ? playgroundUrl : "#"}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              if (!idea.trim() || !selectedAgent) e.preventDefault();
            }}
            className={
              idea.trim() && selectedAgent
                ? "text-[var(--accent)] hover:underline underline-offset-4"
                : "text-white/25 cursor-not-allowed"
            }
          >
            [ open in gitlawb playground ↗ ]
          </a>
          {selectedAgent && idea.trim() && (
            <a
              href={`/agent/${selectedAgent.address}/embed`}
              target="_blank"
              rel="noreferrer"
              className="text-white/55 hover:text-white"
            >
              [ preview embed ↗ ]
            </a>
          )}
        </div>

        {/* Inline curl */}
        {selectedAgent && (
          <details className="mt-2 group">
            <summary className="text-white/30 hover:text-white/55 cursor-pointer list-none select-none">
              <span className="group-open:hidden">[ + show raw curl ]</span>
              <span className="hidden group-open:inline">[ − raw curl ]</span>
            </summary>
            <pre className="mt-2 text-[11px] text-white/65 bg-white/[0.02] p-3 overflow-x-auto whitespace-pre-wrap">
              {`curl -X POST https://www.signaagent.xyz/api/agents/${selectedAgent.address}/respond \\
  -H 'content-type: application/json' \\
  -d '{"message":"hello from my playground app"}'`}
            </pre>
          </details>
        )}
      </div>
    </section>
  );
}
