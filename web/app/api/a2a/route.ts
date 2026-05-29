import { NextRequest, NextResponse } from "next/server";
import {
  extractText,
  genId,
  completedTask,
  jsonRpcResult,
  jsonRpcError,
  type A2AMessage,
} from "@/lib/a2a";
import { chat, providerAvailable } from "@/lib/llm-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/a2a — the SIGNA network's A2A v0.3.0 JSON-RPC endpoint.
 *
 * Any A2A client can `message/send` here and get a real, wallet-signed
 * answer from the SIGNA agent. This is the endpoint named in
 * /.well-known/agent-card.json `url`.
 *
 * Implemented methods: message/send, tasks/get.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-signa-signature",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const SYSTEM = [
  "You are SIGNA, the wallet-signed A2A transport on Base mainnet.",
  "You are answering another AI agent over the A2A protocol. Be concise",
  "(2-4 sentences), concrete, and a little bold. SIGNA's edge over plain",
  "A2A: every message is EIP-191 wallet-signed and persisted as an",
  "undeletable, re-verifiable log, with onchain identity (ERC-8004) and",
  "x402 payments native. Plain text only, no markdown.",
].join(" ");

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonRpcError(null, -32700, "parse_error"), { status: 200, headers: CORS });
  }

  const id = body?.id ?? null;
  const method = body?.method;
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  if (method === "tasks/get") {
    // We don't persist tasks server-side; report unknown so clients fall
    // back to the synchronous result they already received.
    const taskId = body?.params?.id ?? genId("task", String(nowMs));
    return NextResponse.json(
      jsonRpcResult(id, {
        kind: "task",
        id: taskId,
        contextId: genId("ctx", taskId),
        status: { state: "unknown", timestamp: nowIso },
        artifacts: [],
        history: [],
      }),
      { status: 200, headers: CORS },
    );
  }

  if (method !== "message/send" && method !== "message/stream") {
    return NextResponse.json(jsonRpcError(id, -32601, `method_not_found:${method}`), {
      status: 200,
      headers: CORS,
    });
  }

  const inbound = body?.params?.message as A2AMessage | undefined;
  const text = extractText(inbound);
  if (!text) {
    return NextResponse.json(jsonRpcError(id, -32602, "no_text_part_in_message"), {
      status: 200,
      headers: CORS,
    });
  }

  const contextId = inbound?.contextId || genId("ctx", inbound?.messageId || String(nowMs));
  const taskId = genId("task", (inbound?.messageId || "") + nowMs);

  let reply: string;
  try {
    if (!providerAvailable("groq")) {
      reply =
        "SIGNA is the wallet-signed A2A transport on Base: every message EIP-191 signed and persisted forever, with ERC-8004 identity and x402 payments native. (LLM responder not configured on this node.)";
    } else {
      reply = await chat({
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: text },
        ],
        maxTokens: 200,
        temperature: 0.7,
      });
    }
  } catch {
    reply =
      "SIGNA here — reachable over A2A, every reply wallet-signed and logged on Base. (Responder hit a transient error; try again.)";
  }

  const task = completedTask({
    taskId,
    contextId,
    replyText: reply,
    replyMessageId: genId("msg", reply.slice(0, 24) + nowMs),
    inbound: inbound ?? undefined,
    nowIso,
  });

  return NextResponse.json(jsonRpcResult(id, task), { status: 200, headers: CORS });
}
