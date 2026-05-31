import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/swarm/verify
 *
 * The trustless verifier for a SIGNA Swarm receipt. A swarm receipt is the
 * ordered list of wallet-signed messages exchanged by the agents during a
 * mission. This endpoint re-derives everything from scratch and proves the
 * record is authentic AND untampered:
 *
 *   - every message's EIP-191 signature verifies against its sender wallet
 *     (so no message was forged or altered), and
 *   - the hash chain is intact: each message embeds prev = sha256(previous
 *     message's signature), so reordering, inserting, or dropping any
 *     message breaks the chain.
 *
 * No trust in SIGNA required — the same check runs in any viem/ethers
 * client. SIGNA is just where the signed messages were delivered.
 *
 * Body: { messages: [{ from, to, ts, body, signature }, ...] }
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

type Msg = { from: string; to: string; ts: number; body: string; signature: string };

// canonical SIGNA DM preimage — must match the node + SDK exactly
function dmPreimage(from: string, to: string, body: string, ts: number): string {
  return ["SIGNA agent dm v1", `ts:${ts}`, `from:${from.toLowerCase()}`, `to:${to.toLowerCase()}`, `body:${body}`].join("\n");
}
// chain link for a message = first 12 hex of sha256(signature)
function linkOf(signature: string): string {
  return createHash("sha256").update(signature).digest("hex").slice(0, 12);
}
const HEADER_RE = /^\[swarm ([a-z0-9]+) #(\d+) prev ([0-9a-f]+|genesis)\]/i;

export async function POST(req: NextRequest) {
  let messages: Msg[] = [];
  try {
    const body = await req.json();
    messages = body?.messages ?? body?.receipt?.messages ?? [];
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400, headers: CORS });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ ok: false, error: "no_messages" }, { status: 400, headers: CORS });
  }
  if (messages.length > 200) {
    return NextResponse.json({ ok: false, error: "too_many" }, { status: 400, headers: CORS });
  }

  const steps: Array<{ seq: number; from: string; to: string; signatureValid: boolean; chainLinked: boolean; note: string }> = [];
  let signaturesValid = true;
  let chainIntact = true;
  let swarmId: string | null = null;

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    let sigOk = false;
    try {
      sigOk = await verifyMessage({
        address: m.from as `0x${string}`,
        message: dmPreimage(m.from, m.to, m.body, m.ts),
        signature: m.signature as `0x${string}`,
      });
    } catch {
      sigOk = false;
    }
    if (!sigOk) signaturesValid = false;

    const h = HEADER_RE.exec(m.body ?? "");
    let linkOk = false;
    let note = "";
    if (!h) {
      note = "missing swarm header";
      chainIntact = false;
    } else {
      const seq = Number(h[2]);
      const prev = h[3].toLowerCase();
      if (i === 0) swarmId = h[1];
      if (swarmId && h[1] !== swarmId) { note = "swarm id mismatch"; chainIntact = false; }
      if (seq !== i) { note = `seq ${seq} != position ${i}`; chainIntact = false; }
      if (i === 0) {
        linkOk = prev === "genesis";
        if (!linkOk) { note = "genesis prev not 'genesis'"; chainIntact = false; }
      } else {
        const expected = linkOf(messages[i - 1].signature);
        linkOk = prev === expected;
        if (!linkOk) { note = `prev ${prev} != sha256(prev sig) ${expected}`; chainIntact = false; }
      }
    }
    steps.push({ seq: i, from: m.from, to: m.to, signatureValid: sigOk, chainLinked: linkOk || (i === 0 && /prev genesis/i.test(m.body)), note });
  }

  const verified = signaturesValid && chainIntact;
  const head = linkOf(messages[messages.length - 1].signature);

  return NextResponse.json(
    {
      ok: true,
      verified,
      swarmId,
      messageCount: messages.length,
      signaturesValid,
      chainIntact,
      head,
      summary: verified
        ? "Receipt verified: every message is wallet-signed and the hash chain is intact. Tamper-evident, re-verifiable by anyone."
        : "Receipt FAILED verification — a signature is invalid or the hash chain is broken.",
      steps,
    },
    { headers: CORS },
  );
}
