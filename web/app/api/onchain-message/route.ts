import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { readOnchainMessage, recordOnchainMessage, onchainInbox } from "@/lib/onchain-msg";
import { contractInbox, contractOutbox, contractThread, contractRecent, SIGNA_MESSAGES_ADDRESS } from "@/lib/signa-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/onchain-message — wallet → wallet messages on Base.
 *
 * The SignaMessages contract is the primary path (each message is a readable
 * on-chain event; the chain is the index):
 *   GET ?inbox=0x…       → messages sent TO a wallet (from the contract's logs)
 *   GET ?outbox=0x…      → messages a wallet SENT
 *   GET ?thread=0xA,0xB  → the full conversation between two wallets
 *
 * Legacy raw-calldata path (message in a tx's input data, DB-indexed):
 *   GET ?tx=0x…          → read one calldata message straight from the chain
 *   GET ?to=0x…          → DB-indexed calldata inbox (each row re-verified)
 *   POST { tx }          → index a just-broadcast calldata message
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const tx = sp.get("tx");
  const to = sp.get("to");
  const inbox = sp.get("inbox");
  const outbox = sp.get("outbox");
  const thread = sp.get("thread");
  const feed = sp.get("feed");

  // ---- SignaMessages contract (readable events; chain is the index) ----
  if (feed === "recent" || sp.has("recent")) {
    const limit = Math.min(Math.max(Number(sp.get("limit") || 50), 1), 100);
    const messages = await contractRecent(limit);
    return NextResponse.json({ ok: true, contract: SIGNA_MESSAGES_ADDRESS, count: messages.length, messages }, { headers: CORS });
  }
  if (inbox) {
    const messages = await contractInbox(inbox.toLowerCase());
    return NextResponse.json({ ok: true, contract: SIGNA_MESSAGES_ADDRESS, count: messages.length, messages }, { headers: CORS });
  }
  if (outbox) {
    const messages = await contractOutbox(outbox.toLowerCase());
    return NextResponse.json({ ok: true, contract: SIGNA_MESSAGES_ADDRESS, count: messages.length, messages }, { headers: CORS });
  }
  if (thread) {
    const [a, b] = thread.split(",").map((s) => s.trim().toLowerCase());
    const messages = await contractThread(a ?? "", b ?? "");
    return NextResponse.json({ ok: true, contract: SIGNA_MESSAGES_ADDRESS, count: messages.length, messages }, { headers: CORS });
  }

  // ---- legacy raw-calldata path ----
  if (tx) {
    const msg = await readOnchainMessage(tx);
    return msg ? NextResponse.json({ ok: true, ...msg }, { headers: CORS }) : NextResponse.json({ ok: false, error: "not_a_signa_onchain_message" }, { status: 404, headers: CORS });
  }
  if (to) {
    const dbInbox = await onchainInbox(serverClient(), to.toLowerCase());
    return NextResponse.json({ ok: true, count: dbInbox.length, messages: dbInbox }, { headers: CORS });
  }
  return NextResponse.json({ ok: false, error: "pass ?inbox=, ?outbox=, ?thread=A,B (contract) or ?tx=, ?to= (calldata)" }, { status: 400, headers: CORS });
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const r = await recordOnchainMessage(serverClient(), String(b.tx ?? ""));
  return NextResponse.json(r, { status: r.ok ? 200 : 400, headers: CORS });
}
