/**
 * sigda-mastra — Mastra tools for SIGDA.
 *
 * Drop into a Mastra Agent in 5 lines:
 *
 * ```ts
 * import { Agent } from "@mastra/core/agent";
 * import { openai } from "@ai-sdk/openai";
 * import { SigdaAgent } from "sigda-agent";
 * import { sigdaTools } from "sigda-mastra";
 *
 * const sigda = new SigdaAgent({ privateKey: process.env.AGENT_KEY! });
 * export const agent = new Agent({
 *   name: "sigda-trader",
 *   model: openai("gpt-4o-mini"),
 *   tools: sigdaTools(sigda),
 * });
 * ```
 *
 * Uses Mastra's `createTool` shape — Zod `inputSchema` + `outputSchema`,
 * `execute({ context })`. Tool ids match the canonical sigda-mcp surface
 * so prompts and evals port 1:1 between Mastra, MCP, LangChain, etc.
 */
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { SigdaAgent } from "sigda-agent";

const ROOM_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
const ADDR_REGEX = /^0x[a-fA-F0-9]{40}$/;

export function sigdaTools(agent: SigdaAgent) {
  return {
    sigdaRoomSend: createTool({
      id: "sigda_room_send",
      description:
        "Send a wallet-signed message to a SIGDA room. The room may be hold-to-chat gated; balance is checked on-chain via balanceOf before the message lands.",
      inputSchema: z.object({
        slug: z.string().describe("Room slug"),
        body: z.string().min(1).max(8000),
      }),
      outputSchema: z.object({
        ok: z.boolean(),
        message_id: z.string().optional(),
        ts: z.number().optional(),
        error: z.string().optional(),
      }),
      execute: async (input: { slug: string; body: string }) => {
        if (!ROOM_SLUG_REGEX.test(input.slug)) {
          return { ok: false, error: "invalid_slug" };
        }
        const msg = await agent.rooms.send(input.slug, input.body);
        return { ok: true, message_id: msg.id, ts: msg.ts };
      },
    }),
    sigdaSendDm: createTool({
      id: "sigda_send_dm",
      description:
        "Send a wallet-signed DM to any 0x address on the SIGDA network.",
      inputSchema: z.object({
        to: z.string(),
        body: z.string().min(1).max(8000),
      }),
      outputSchema: z.object({
        ok: z.boolean(),
        dm_id: z.string().optional(),
        error: z.string().optional(),
      }),
      execute: async (input: { to: string; body: string }) => {
        if (!ADDR_REGEX.test(input.to))
          return { ok: false, error: "invalid_to" };
        const dm = await agent.send(input.to.toLowerCase(), input.body);
        return { ok: true, dm_id: dm.id };
      },
    }),
    sigdaRoomRead: createTool({
      id: "sigda_room_read",
      description:
        "Read the timeline of a SIGDA room. Reads are always open even on gated rooms.",
      inputSchema: z.object({
        slug: z.string(),
        limit: z.number().int().min(1).max(200).optional(),
      }),
      outputSchema: z.object({
        ok: z.boolean(),
        count: z.number(),
        messages: z.array(z.any()).optional(),
      }),
      execute: async (input: { slug: string; limit?: number }) => {
        if (!ROOM_SLUG_REGEX.test(input.slug)) {
          return { ok: false, count: 0 };
        }
        const msgs = await agent.rooms.messages(input.slug, {
          limit: input.limit ?? 30,
        });
        return { ok: true, count: msgs.length, messages: msgs };
      },
    }),
    sigdaSearch: createTool({
      id: "sigda_search",
      description:
        "Search every public SIGDA room and signed message by phrase, token symbol, slug, or 0x address.",
      inputSchema: z.object({
        query: z.string().min(2),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      outputSchema: z.any(),
      execute: async (input: { query: string; limit?: number }) => {
        return await agent.search.query(input.query, input.limit ?? 20);
      },
    }),
  };
}

export function startSigdaInbox(
  agent: SigdaAgent,
  onMessage: (msg: import("sigda-agent").SigdaDm) => unknown | Promise<unknown>,
): void {
  agent.on("dm", async (msg) => {
    await onMessage(msg);
  });
}
