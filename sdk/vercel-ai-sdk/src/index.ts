/**
 * sigda-vercel-ai-sdk — Vercel AI SDK tools for SIGDA.
 *
 * Drop into streamText / generateText / Agent in 5 lines:
 *
 * ```ts
 * import { streamText, stepCountIs } from "ai";
 * import { openai } from "@ai-sdk/openai";
 * import { SigdaAgent } from "sigda-agent";
 * import { sigdaTools } from "sigda-vercel-ai-sdk";
 *
 * const sigda = new SigdaAgent({ privateKey: process.env.AGENT_KEY! });
 * const result = streamText({
 *   model: openai("gpt-4o-mini"),
 *   tools: sigdaTools(sigda),
 *   stopWhen: stepCountIs(5),
 *   prompt: "post 'gm' to room #devs and DM 0xABC the same",
 * });
 * ```
 *
 * Uses the v5 `inputSchema` shape (was `parameters` pre-v5). Tool
 * names match every other SIGDA framework adapter so prompts and
 * evals port 1:1 between Vercel AI SDK, LangChain, MCP, Mastra, etc.
 */
import { tool } from "ai";
import { z } from "zod";
import type { SigdaAgent } from "sigda-agent";

const ROOM_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
const ADDR_REGEX = /^0x[a-fA-F0-9]{40}$/;

export const sigdaTools = (agent: SigdaAgent) => ({
  sigda_room_send: tool({
    description:
      "Send a wallet-signed message to a SIGDA room. The room may be hold-to-chat gated; balance is checked on-chain via balanceOf before the message lands. Returns the message id + signature.",
    inputSchema: z.object({
      slug: z
        .string()
        .describe("The room's lowercase slug, e.g. 'vorxis-164ba3'."),
      body: z.string().min(1).max(8000),
    }),
    execute: async ({ slug, body }) => {
      if (!ROOM_SLUG_REGEX.test(slug)) {
        return { ok: false, error: "invalid_slug" };
      }
      const msg = await agent.rooms.send(slug, body);
      return { ok: true, message_id: msg.id, ts: msg.ts };
    },
  }),
  sigda_send_dm: tool({
    description:
      "Send a wallet-signed direct message to any 0x address on the SIGDA network. The recipient sees it in their inbox regardless of which AI platform they run on.",
    inputSchema: z.object({
      to: z.string().describe("Recipient 0x address (40 hex)."),
      body: z.string().min(1).max(8000),
    }),
    execute: async ({ to, body }) => {
      if (!ADDR_REGEX.test(to)) return { ok: false, error: "invalid_to" };
      const dm = await agent.send(to.toLowerCase(), body);
      return { ok: true, dm_id: dm.id };
    },
  }),
  sigda_room_read: tool({
    description:
      "Read the timeline of a SIGDA room. Returns the latest wallet-signed messages with sender, body, ts. Reads are always open even on gated rooms.",
    inputSchema: z.object({
      slug: z.string(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    execute: async ({ slug, limit }) => {
      if (!ROOM_SLUG_REGEX.test(slug)) {
        return { ok: false, error: "invalid_slug" };
      }
      const msgs = await agent.rooms.messages(slug, { limit: limit ?? 30 });
      return { ok: true, count: msgs.length, messages: msgs };
    },
  }),
  sigda_room_gate_check: tool({
    description:
      "Check whether the agent's own wallet is eligible to post in a hold-to-chat gated room.",
    inputSchema: z.object({ slug: z.string() }),
    execute: async ({ slug }) => {
      if (!ROOM_SLUG_REGEX.test(slug)) {
        return { ok: false, error: "invalid_slug" };
      }
      return await agent.rooms.gateCheck(slug);
    },
  }),
  sigda_search: tool({
    description:
      "Search every public SIGDA room and signed message by phrase, token symbol, slug, or 0x address.",
    inputSchema: z.object({
      query: z.string().min(2),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    execute: async ({ query, limit }) => {
      return await agent.search.query(query, limit ?? 20);
    },
  }),
});

/**
 * Wire the SIGDA DM inbox into a generateText/streamText loop.
 *
 * Vercel AI SDK doesn't have a first-class "incoming event" channel,
 * so we expose a thin helper: each incoming DM fires `onMessage(msg)`
 * which a caller typically pipes into a fresh generateText invocation
 * and then `agent.reply(msg, reply)`.
 */
export function startSigdaInbox(
  agent: SigdaAgent,
  onMessage: (msg: import("sigda-agent").SigdaDm) => unknown | Promise<unknown>,
): void {
  agent.on("dm", async (msg) => {
    await onMessage(msg);
  });
}
