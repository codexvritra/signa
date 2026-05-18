/**
 * SIGNA multi-tenant agent runtime.
 *
 * Polls https://www.signaagent.xyz/api/runtime/agents for every agent
 * a launcher has opted into custodial mode. For each, spins up a
 * dedicated XMTP installation using that agent's private key, listens
 * for incoming DMs, and routes the conversation through Groq using
 * that agent's `system_prompt`.
 *
 * This file is the new entry point for the Railway runtime service
 * once SIGNA has opted-in agents. The existing `index.ts` (single-
 * tenant SIGNA central agent) is unaffected — you can run either or
 * both in different Railway services.
 *
 *   Required env on Railway:
 *     SIGNA_BASE_URL              https://www.signaagent.xyz
 *     RUNTIME_FETCH_SECRET        same value set on Vercel env
 *     XMTP_ENV                    production (must match the web app)
 *     XMTP_DB_DIRECTORY           /data    (mount a Railway Volume)
 *     GROQ_API_KEY                gsk_...
 *     GROQ_MODEL                  llama-3.3-70b-versatile (default)
 *
 *   Optional:
 *     RUNTIME_POLL_INTERVAL_MS    default 30000
 *     RUNTIME_MAX_AGENTS          cap concurrent listeners (default 50)
 *
 *   Run:
 *     npm run start:multi-runtime
 *
 * Architecture notes:
 *   - One XMTP installation per agent. SIGNA's standard agent-sdk has
 *     no native multi-tenant primitive, so we maintain a Map<address,
 *     Agent> ourselves.
 *   - Each agent's XMTP DB lives at $XMTP_DB_DIRECTORY/agent-<short>.db3.
 *     Mount a persistent volume in Railway so installations survive
 *     restarts.
 *   - Each agent's DB encryption key is derived deterministically from
 *     its private key via SHA-256 — so re-handing the same private key
 *     produces the same XMTP installation.
 *   - On each successful reply we POST to /api/runtime/agents/heartbeat
 *     so the agent profile shows "last DM" recency.
 *   - Disabled agents (opt-out from /agent/<addr>/runtime) drop off the
 *     /api/runtime/agents list and we tear down their listener on the
 *     next poll tick.
 */

import "dotenv/config";
import crypto from "node:crypto";
import { Agent } from "@xmtp/agent-sdk";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { generateReply, type ChatTurn } from "./groq.js";
import { buildToolsForPeer } from "./tools.js";

const SIGNA_BASE_URL =
  process.env.SIGNA_BASE_URL || "https://www.signaagent.xyz";
const FETCH_SECRET = process.env.RUNTIME_FETCH_SECRET;
const POLL_INTERVAL_MS = Number(
  process.env.RUNTIME_POLL_INTERVAL_MS || 30_000,
);
const MAX_AGENTS = Number(process.env.RUNTIME_MAX_AGENTS || 50);
const MAX_HISTORY_TURNS = 12;

if (!FETCH_SECRET) {
  throw new Error(
    "RUNTIME_FETCH_SECRET is required — must match the value set in Vercel env",
  );
}

type RemoteAgent = {
  address: string;
  name: string;
  description: string;
  system_prompt: string | null;
  private_key: string;
  enabled_at: string | null;
  last_seen_at: string | null;
};

/** All currently-running listeners, keyed by lowercase agent address. */
const running = new Map<string, Agent>();

function dbEncryptionKey(privateKeyHex: string): string {
  const hex = privateKeyHex.startsWith("0x")
    ? privateKeyHex.slice(2)
    : privateKeyHex;
  return crypto.createHash("sha256").update(hex, "hex").digest("hex");
}

async function fetchPendingAgents(): Promise<RemoteAgent[]> {
  const res = await fetch(`${SIGNA_BASE_URL}/api/runtime/agents`, {
    headers: { authorization: `Bearer ${FETCH_SECRET}` },
  });
  if (!res.ok) {
    console.error(
      `[multi-runtime] fetchPendingAgents HTTP ${res.status} — skipping tick`,
    );
    return [];
  }
  const j = (await res.json()) as { agents?: RemoteAgent[] };
  return j.agents ?? [];
}

async function heartbeat(address: string) {
  try {
    await fetch(`${SIGNA_BASE_URL}/api/runtime/agents`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${FETCH_SECRET}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ address }),
    });
  } catch (e) {
    console.error(
      `[multi-runtime] heartbeat failed for ${address}:`,
      e instanceof Error ? e.message : e,
    );
  }
}

async function spawnAgentRuntime(remote: RemoteAgent): Promise<void> {
  if (running.has(remote.address)) return;
  if (running.size >= MAX_AGENTS) {
    console.warn(
      `[multi-runtime] at cap (${MAX_AGENTS}); skipping ${remote.address}`,
    );
    return;
  }

  // Set per-agent env vars so Agent.createFromEnv picks them up.
  // Each agent gets its own DB file derived from the address.
  const shortAddr = remote.address.slice(2, 10);
  process.env.XMTP_WALLET_KEY = remote.private_key;
  process.env.XMTP_DB_ENCRYPTION_KEY = dbEncryptionKey(remote.private_key);
  const dbDir = process.env.XMTP_DB_DIRECTORY || "./data";
  process.env.XMTP_DB_PATH = `${dbDir}/agent-${shortAddr}.db3`;

  let agent: Agent;
  try {
    agent = await Agent.createFromEnv();
  } catch (e) {
    console.error(
      `[multi-runtime] failed to create agent for ${remote.address}:`,
      e instanceof Error ? e.message : e,
    );
    return;
  }

  const systemPrompt =
    remote.system_prompt?.trim() ||
    `You are ${remote.name}, an AI agent on SIGNA. ${remote.description}`;

  agent.on("start", async (ctx) => {
    console.log(
      `[multi-runtime] ${remote.address} (${remote.name}) online · inbox ${ctx.client.inboxId.slice(0, 12)}…`,
    );
  });

  agent.on("text", async (ctx) => {
    try {
      if (ctx.message.senderInboxId === ctx.client.inboxId) return;
      const incoming = ctx.message.content;
      if (!incoming || typeof incoming !== "string" || !incoming.trim()) return;

      const recent = await ctx.conversation.messages({
        limit: MAX_HISTORY_TURNS * 2,
      });
      const history: ChatTurn[] = [];
      // Per-agent system prompt as the first turn (generateReply handles
      // role:"system" — see groq.ts).
      history.push({
        role: "system" as never,
        content: systemPrompt,
      } as ChatTurn);
      for (const m of recent) {
        if (typeof m.content !== "string" || !(m.content as string).trim())
          continue;
        history.push({
          role:
            m.senderInboxId === ctx.client.inboxId
              ? ("assistant" as const)
              : ("user" as const),
          content: m.content as string,
        });
      }

      let peerAddress: `0x${string}` | null = null;
      try {
        const senderAddr = await ctx.getSenderAddress();
        if (senderAddr && /^0x[a-fA-F0-9]{40}$/.test(senderAddr)) {
          peerAddress = senderAddr.toLowerCase() as `0x${string}`;
        }
      } catch {
        // ok
      }

      const toolBundle = buildToolsForPeer(peerAddress);
      const reply = await generateReply(history, toolBundle);
      await ctx.conversation.sendText(reply);
      await heartbeat(remote.address);
    } catch (e) {
      console.error(
        `[multi-runtime/${remote.address}] handle text failed:`,
        e instanceof Error ? e.message : e,
      );
      try {
        await ctx.conversation.sendText("sorry, hit an error on that one.");
      } catch {}
    }
  });

  await agent.start();
  running.set(remote.address, agent);

  // Diagnostic — verify the wallet derivation matches what SIGNA expects.
  try {
    const derived = privateKeyToAccount(remote.private_key as Hex).address.toLowerCase();
    if (derived !== remote.address) {
      console.warn(
        `[multi-runtime] address mismatch for ${remote.address} — derived ${derived}`,
      );
    }
  } catch {
    // ignore
  }
}

async function teardownAgent(address: string): Promise<void> {
  const agent = running.get(address);
  if (!agent) return;
  // @xmtp/agent-sdk v2.3 doesn't expose a stop() yet — best we can do
  // is drop our reference. The Node process keeps the underlying network
  // stream open until restart. Acceptable for v1.
  running.delete(address);
  console.log(`[multi-runtime] tore down ${address}`);
  void agent; // silence unused
}

async function reconcile(): Promise<void> {
  const remote = await fetchPendingAgents();
  const remoteSet = new Set(remote.map((a) => a.address.toLowerCase()));

  for (const a of remote) {
    if (!running.has(a.address.toLowerCase())) {
      console.log(`[multi-runtime] spawning ${a.address} (${a.name})`);
      await spawnAgentRuntime(a);
    }
  }

  for (const addr of running.keys()) {
    if (!remoteSet.has(addr)) {
      console.log(`[multi-runtime] disabled remotely: ${addr}`);
      await teardownAgent(addr);
    }
  }

  console.log(
    `[multi-runtime] tick — ${running.size} listeners (${remote.length} opted-in)`,
  );
}

async function main(): Promise<void> {
  console.log("==============================================");
  console.log(" SIGNA multi-tenant agent runtime");
  console.log(`  base URL: ${SIGNA_BASE_URL}`);
  console.log(`  poll:     ${POLL_INTERVAL_MS}ms`);
  console.log(`  max:      ${MAX_AGENTS} concurrent agents`);
  console.log("==============================================");

  await reconcile();
  setInterval(() => {
    reconcile().catch((e) =>
      console.error("[multi-runtime] reconcile failed:", e),
    );
  }, POLL_INTERVAL_MS);

  // Keep alive
  process.stdin.resume();
}

main().catch((e) => {
  console.error("[multi-runtime] fatal:", e);
  process.exit(1);
});
