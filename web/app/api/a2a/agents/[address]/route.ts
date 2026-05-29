import { NextRequest, NextResponse } from "next/server";
import { buildMessageToSign } from "@/lib/feed-types";
import {
  a2aGatewayAccount,
  extractText,
  genId,
  completedTask,
  jsonRpcResult,
  jsonRpcError,
  type A2AMessage,
} from "@/lib/a2a";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/a2a/agents/[address] — A2A v0.3.0 JSON-RPC endpoint for a
 * specific SIGNA agent (the `url` in that agent's agent-card.json).
 *
 * An off-the-shelf A2A client `message/send`s here. SIGNA relays the
 * message into the target agent's wallet-signed inbox: the a2a-gateway
 * wallet signs an EIP-191 envelope attesting "received via A2A from
 * <caller>", so even a message from a non-crypto A2A agent becomes an
 * undeletable, re-verifiable inbox entry. Returns a completed A2A Task.
 *
 * Methods: message/send, tasks/get.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-signa-signature",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address: raw } = await params;
  const to = (raw ?? "").toLowerCase();

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

  if (!/^0x[a-f0-9]{40}$/.test(to)) {
    return NextResponse.json(jsonRpcError(id, -32602, "invalid_agent_address"), { status: 200, headers: CORS });
  }

  if (method === "tasks/get") {
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
    return NextResponse.json(jsonRpcError(id, -32601, `method_not_found:${method}`), { status: 200, headers: CORS });
  }

  const inbound = body?.params?.message as A2AMessage | undefined;
  const text = extractText(inbound);
  if (!text) {
    return NextResponse.json(jsonRpcError(id, -32602, "no_text_part_in_message"), { status: 200, headers: CORS });
  }

  // Caller identity: A2A clients may declare themselves in metadata.
  const callerName =
    (inbound?.metadata?.["from"] as string) ||
    (inbound?.metadata?.["agentName"] as string) ||
    (body?.params?.metadata?.["from"] as string) ||
    "an A2A agent";

  // Relay into the target's wallet-signed inbox, attested by the
  // deterministic a2a-gateway wallet.
  const gateway = a2aGatewayAccount();
  const from = gateway.address.toLowerCase();
  const deliveredBody = `[via A2A · from ${callerName}] ${text}`.slice(0, 7900);
  const ts = nowMs;
  const preimage = buildMessageToSign({
    kind: "agent_dm",
    from,
    to,
    body: deliveredBody,
    ts,
  });
  const signature = await gateway.signMessage({ message: preimage });

  let delivered = false;
  let dmId: string | null = null;
  try {
    const r = await fetch(`${req.nextUrl.origin}/api/agents/${from}/dm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from, to, body: deliveredBody, ts, signature }),
    });
    const j = await r.json().catch(() => ({}));
    delivered = !!j?.ok;
    dmId = j?.dm?.id ?? null;
  } catch {
    delivered = false;
  }

  const contextId = inbound?.contextId || genId("ctx", inbound?.messageId || String(nowMs));
  const taskId = genId("task", (inbound?.messageId || "") + nowMs);

  const ackText = delivered
    ? `Delivered to ${to} on SIGNA — wallet-signed and re-verifiable. Inbox: ${req.nextUrl.origin}/api/agents/${to}/inbox · DM id: ${dmId}`
    : `SIGNA received your A2A message for ${to} but inbox relay failed; retry shortly.`;

  const task = completedTask({
    taskId,
    contextId,
    replyText: ackText,
    replyMessageId: genId("msg", ackText.slice(0, 24) + nowMs),
    inbound: inbound ?? undefined,
    state: delivered ? "completed" : "failed",
    nowIso,
  });

  return NextResponse.json(jsonRpcResult(id, task), { status: 200, headers: CORS });
}
