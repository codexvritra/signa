import { NextRequest, NextResponse } from "next/server";
import {
  extractText,
  genId,
  completedTask,
  dataArtifact,
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
 * Any A2A client can `message/send` here and reach the whole SIGNA mesh with
 * zero SIGNA-specific code — it just speaks A2A. The message is routed:
 *
 *   - capability invocation  → "invoke <cap> [arg]" or a data part {cap, arg}
 *                              returns the WALLET-SIGNED capability result as
 *                              an A2A data artifact (re-verifiable with viem)
 *   - the brain              → "brain: <goal>" or the `brain` skill — reasons,
 *                              calls capabilities, answers from live data, signs
 *   - anything else          → the SIGNA agent answers (wallet-signed log)
 *
 * Implemented methods: message/send, message/stream, tasks/get.
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

/** Pull a capability request out of an inbound A2A message, if present. */
function parseCapRequest(msg: A2AMessage | undefined, text: string): { cap: string; arg: string } | null {
  // 1. structured data part { cap, arg }
  const dataPart = msg?.parts?.find((p) => p.kind === "data" && p.data && typeof (p.data as any).cap === "string");
  if (dataPart) {
    const d = dataPart.data as Record<string, unknown>;
    return { cap: String(d.cap), arg: d.arg != null ? String(d.arg) : "" };
  }
  // 2. metadata.skillId === "capabilities" with cap/arg in metadata
  const meta = msg?.metadata as Record<string, unknown> | undefined;
  if (meta?.skillId === "capabilities" && typeof meta?.cap === "string") {
    return { cap: meta.cap, arg: meta.arg != null ? String(meta.arg) : "" };
  }
  // 3. text form: "invoke <cap> [arg...]"
  const m = text.match(/^\s*invoke\s+([a-z0-9][a-z0-9._-]{1,39})(?:\s+([\s\S]+))?$/i);
  if (m) return { cap: m[1], arg: (m[2] ?? "").trim() };
  return null;
}

/** Is this message asking for the brain? (skill targeting or "brain:" prefix) */
function parseBrainGoal(msg: A2AMessage | undefined, text: string): string | null {
  const meta = msg?.metadata as Record<string, unknown> | undefined;
  if (meta?.skillId === "brain" && text) return text.replace(/^\s*brain\s*:\s*/i, "").trim();
  const m = text.match(/^\s*(?:brain|ask the network)\s*[:\-]\s*([\s\S]+)$/i);
  return m ? m[1].trim() : null;
}

async function invokeCapability(origin: string, cap: string, arg: string): Promise<any> {
  const r = await fetch(`${origin}/api/capabilities/invoke`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cap, arg }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function askBrain(origin: string, goal: string): Promise<any> {
  const r = await fetch(`${origin}/api/brain`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ goal }),
  });
  return r.json().catch(() => ({}));
}

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
  const origin = req.nextUrl.origin;

  let reply = "";
  let artifacts: unknown[] | undefined;

  // ── route 1: invoke a capability → wallet-signed result as a data artifact ──
  const capReq = parseCapRequest(inbound, text);
  if (capReq) {
    try {
      const { status, body } = await invokeCapability(origin, capReq.cap, capReq.arg);
      if (status === 402) {
        reply = `Capability "${capReq.cap}" is priced — pay the provider via x402 to call it. See the 402 challenge artifact.`;
        artifacts = [dataArtifact("x402-challenge", body, capReq.cap)];
      } else if (body?.ok) {
        reply = `Invoked ${capReq.cap}${capReq.arg ? ` (${capReq.arg})` : ""}. Result is signed by the gateway ${body.gateway} and re-verifiable with viem.`;
        artifacts = [dataArtifact("capability-result", body, capReq.cap)];
      } else {
        reply = `Could not invoke "${capReq.cap}": ${body?.error ?? `HTTP ${status}`}. Browse available capabilities at /api/capabilities.`;
      }
    } catch {
      reply = `The capability mesh hit a transient error invoking "${capReq.cap}". Try again.`;
    }
  } else {
    // ── route 2: the brain (explicit) ──
    const brainGoal = parseBrainGoal(inbound, text);
    if (brainGoal) {
      try {
        const b = await askBrain(origin, brainGoal);
        if (b?.ok && b.answer) {
          reply = b.answer;
          artifacts = [dataArtifact("brain-receipt", { goal: brainGoal, plan: b.plan, brain: b.brain, signature: b.signature, verify: b.verify }, brainGoal.slice(0, 24))];
        } else {
          reply = "The brain is momentarily unavailable; try again.";
        }
      } catch {
        reply = "The brain hit a transient error; try again.";
      }
    } else {
      // ── route 3: the SIGNA agent answers (chat) ──
      try {
        if (!providerAvailable("groq")) {
          reply =
            "SIGNA is the wallet-signed A2A transport on Base: every message EIP-191 signed and persisted forever, with ERC-8004 identity and x402 payments native. Send 'invoke <capability>' to call the mesh, or 'brain: <goal>' to reason over it.";
        } else {
          reply = await chat({
            provider: "groq",
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: SYSTEM + " If useful, tell the agent it can send 'invoke <capability>' to call the SIGNA marketplace or 'brain: <goal>' to reason over it." },
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
    }
  }

  const task = completedTask({
    taskId,
    contextId,
    replyText: reply,
    replyMessageId: genId("msg", reply.slice(0, 24) + nowMs),
    inbound: inbound ?? undefined,
    nowIso,
    ...(artifacts ? { artifacts } : {}),
  });

  return NextResponse.json(jsonRpcResult(id, task), { status: 200, headers: CORS });
}
