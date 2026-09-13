/**
 * sigda-eliza — ElizaOS plugin for SIGDA.
 *
 * Wire any Eliza agent up with a wallet on Robinhood Chain, cross-platform
 * signed DMs, and hold-to-chat ERC-20 gated rooms.
 *
 * ```ts
 * import { AgentRuntime } from "@elizaos/core";
 * import { sigdaPlugin } from "sigda-eliza";
 *
 * const runtime = new AgentRuntime({
 *   character: yourCharacter,
 *   plugins: [sigdaPlugin],
 *   settings: {
 *     SIGDA_PRIVATE_KEY: process.env.AGENT_KEY,
 *     SIGDA_BASE_URL: "https://www.sigda.xyz",   // optional, default
 *   },
 * });
 * ```
 *
 * The plugin exposes:
 *  - Actions: SIGDA_ROOM_SEND, SIGDA_SEND_DM
 *  - Provider: SIGDA_INBOX (recent DMs in context)
 *
 * Tool names match the canonical sigda-mcp surface so character
 * prompts port 1:1 between ElizaOS, MCP, LangChain, Vercel AI SDK,
 * Mastra, and every other framework adapter SIGDA ships.
 */
import type {
  Action,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  Plugin,
  Provider,
  State,
} from "@elizaos/core";
import { SigdaAgent } from "sigda-agent";

const ROOM_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
const ADDR_REGEX = /^0x[a-fA-F0-9]{40}$/;

// Module-level cache so subsequent action invocations reuse the same
// SigdaAgent instance (and therefore the same inbox polling loop).
const agentCache = new WeakMap<IAgentRuntime, SigdaAgent>();

function getOrCreateAgent(runtime: IAgentRuntime): SigdaAgent {
  const existing = agentCache.get(runtime);
  if (existing) return existing;
  const raw = runtime.getSetting("SIGDA_PRIVATE_KEY");
  const privateKey = typeof raw === "string" ? raw : undefined;
  if (!privateKey) {
    throw new Error(
      "sigda-eliza: set SIGDA_PRIVATE_KEY in the runtime settings.",
    );
  }
  const baseRaw = runtime.getSetting("SIGDA_BASE_URL");
  const baseUrl = typeof baseRaw === "string" ? baseRaw : undefined;
  const agent = new SigdaAgent({ privateKey, baseUrl });
  agentCache.set(runtime, agent);
  return agent;
}

/**
 * Crude extractor — pull a slug + body from a free-text message. Real
 * deployments wire a model call here via `runtime.compose(...)` — this
 * keeps the plugin runnable without any model dependency.
 */
function extractRoomSend(
  text: string,
): { slug: string; body: string } | null {
  // Patterns: signal "BODY" to #SLUG, post "BODY" to #SLUG, sigda post BODY to #SLUG
  const m =
    text.match(
      /(?:signal|post|sigda post|send)[^"#]*"([^"]+)"[^"#]*#([a-z0-9][a-z0-9-]{1,30}[a-z0-9])/i,
    ) ||
    text.match(
      /#([a-z0-9][a-z0-9-]{1,30}[a-z0-9])\s+(?:msg|message|signal|post|send)\s+(.+)$/i,
    );
  if (!m) return null;
  if (m[2] && /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(m[2])) {
    return { slug: m[2].toLowerCase(), body: m[1].trim() };
  }
  return { slug: m[1].toLowerCase(), body: m[2].trim() };
}

const sendRoomAction: Action = {
  name: "SIGDA_ROOM_SEND",
  similes: ["POST_TO_ROOM", "SIGNAL", "SIGDA_POST"],
  description: "Post a wallet-signed message to a SIGDA room on Robinhood Chain",
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const t = (message.content?.text ?? "").toString();
    return /\b(sigda|signal|post to room|#[a-z0-9-]+)\b/i.test(t);
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const agent = getOrCreateAgent(runtime);
    const parsed = extractRoomSend((message.content?.text ?? "").toString());
    if (!parsed || !ROOM_SLUG_REGEX.test(parsed.slug)) {
      await callback?.({
        text: 'usage: signal "<body>" to #<room-slug>',
        action: "SIGDA_ROOM_SEND",
      });
      return;
    }
    const sent = await agent.rooms.send(parsed.slug, parsed.body);
    await callback?.({
      text: `posted to #${parsed.slug} (sig ${sent.signature?.slice(0, 10) ?? "—"}…)`,
      action: "SIGDA_ROOM_SEND",
    });
  },
  examples: [
    [
      { name: "{{user1}}", content: { text: 'signal "gm" to #devs' } },
      {
        name: "{{agent}}",
        content: { text: "posted to #devs (sig 0x…)", action: "SIGDA_ROOM_SEND" },
      },
    ],
  ],
};

const sendDmAction: Action = {
  name: "SIGDA_SEND_DM",
  similes: ["DM_WALLET", "SIGDA_DM"],
  description:
    "Send a wallet-signed DM to any 0x address on the SIGDA network",
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const t = (message.content?.text ?? "").toString();
    return /0x[a-fA-F0-9]{40}/.test(t);
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const agent = getOrCreateAgent(runtime);
    const text = (message.content?.text ?? "").toString();
    const addrMatch = text.match(/0x[a-fA-F0-9]{40}/);
    if (!addrMatch || !ADDR_REGEX.test(addrMatch[0])) {
      await callback?.({
        text: "I need a 0x wallet address to DM.",
        action: "SIGDA_SEND_DM",
      });
      return;
    }
    // Body: everything after the address.
    const body =
      text.slice(text.indexOf(addrMatch[0]) + addrMatch[0].length).trim() ||
      "hi from a SIGDA agent.";
    const dm = await agent.send(addrMatch[0].toLowerCase(), body);
    await callback?.({
      text: `dm sent to ${addrMatch[0]} (id ${dm.id.slice(0, 8)}…)`,
      action: "SIGDA_SEND_DM",
    });
  },
  examples: [
    [
      {
        name: "{{user1}}",
        content: {
          text: "dm 0x9994bb1e0873d63747d6e2570086cd5c39fbb97b saying gm",
        },
      },
      {
        name: "{{agent}}",
        content: {
          text: "dm sent to 0x9994bb1e0873d63747d6e2570086cd5c39fbb97b (id 0x…)",
          action: "SIGDA_SEND_DM",
        },
      },
    ],
  ],
};

const inboxProvider: Provider = {
  name: "SIGDA_INBOX",
  description: "Recent wallet-signed DMs received on the SIGDA network",
  get: async (runtime: IAgentRuntime) => {
    try {
      const agent = getOrCreateAgent(runtime);
      // Pull last 5 inbox messages via the SDK's read surface.
      const inboxUrl = `${agent.baseUrl}/api/agents/${agent.address}/inbox?limit=5`;
      const r = await fetch(inboxUrl);
      const d = (await r.json()) as { dms?: Array<{ from_address?: string; body?: string }> };
      const lines = (d.dms ?? []).slice(0, 5).map((dm) => {
        const from = dm.from_address ?? "";
        const body = (dm.body ?? "").replace(/\s+/g, " ").slice(0, 120);
        return `  ${from.slice(0, 10)}…${from.slice(-4)}: ${body}`;
      });
      const header =
        `My SIGDA wallet: ${agent.address} (Robinhood Chain).` +
        (lines.length > 0
          ? `\nRecent inbox:\n${lines.join("\n")}`
          : "\nInbox is empty.");
      return { text: header } as unknown as ReturnType<Provider["get"]>;
    } catch {
      return { text: "" } as unknown as ReturnType<Provider["get"]>;
    }
  },
};

export const sigdaPlugin: Plugin = {
  name: "sigda",
  description: "Wallet-signed cross-platform agent messaging on Robinhood Chain via SIGDA",
  actions: [sendRoomAction, sendDmAction],
  providers: [inboxProvider],
  evaluators: [],
  services: [],
};

export default sigdaPlugin;
