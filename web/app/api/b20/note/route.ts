import { NextRequest, NextResponse } from "next/server";
import { B20_NETWORK, buildB20Note, type B20NoteFields } from "@/lib/b20";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/b20/note — verifiable money-messages on B20.
 *
 * B20's transferWithMemo(to, amount, bytes32 memo) lets a transfer carry a memo on-chain.
 * SIGNA turns that into a wallet-signed note: the memo = keccak256 of a canonical note the
 * PAYER signs. This endpoint BUILDS the unsigned note — the preimage to sign, the on-chain
 * memo, and the transferWithMemo calldata. The payer's wallet (or an agent key) then signs
 * the preimage and broadcasts the transfer; anyone re-verifies via /api/verify (kind b20_memo),
 * recovering the payer and binding the note to the on-chain Memo event. SIGNA holds no key.
 *
 * POST { token, to, amount, note, from }
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
function json(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, { ...init, headers: { ...(init?.headers ?? {}), ...CORS } });
}
const isAddr = (a: unknown) => typeof a === "string" && /^0x[a-fA-F0-9]{40}$/.test(a);

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid json" }, { status: 400 }); }

  const token = String(body.token ?? "").trim();
  const to = String(body.to ?? "").trim();
  const from = String(body.from ?? "").trim();
  const amount = String(body.amount ?? "").trim();
  const note = String(body.note ?? "").trim();
  if (!isAddr(token)) return json({ ok: false, error: "token must be a B20 address (0x…40)" }, { status: 400 });
  if (!isAddr(to)) return json({ ok: false, error: "to must be a wallet address (0x…40)" }, { status: 400 });
  if (!isAddr(from)) return json({ ok: false, error: "from must be the payer wallet (0x…40)" }, { status: 400 });
  if (!/^\d+$/.test(amount)) return json({ ok: false, error: "amount must be a raw integer (base units)" }, { status: 400 });
  if (!note || note.length > 280) return json({ ok: false, error: "note required (≤280 chars)" }, { status: 400 });

  const fields: B20NoteFields = { ts: Date.now(), from, to, token, amount, note };
  try {
    const built = buildB20Note(fields);
    return json({
      ok: true,
      network: B20_NETWORK,
      ...fields,
      preimage: built.preimage,   // the payer signs THIS (EIP-191 personal_sign)
      memo: built.memo,           // bytes32 — pass as the transferWithMemo memo
      note_hash: built.note_hash,
      tx: built.tx,               // { to: token, data: transferWithMemo calldata, value: 0 }
      reverify: built.reverify,   // add `signature` after signing, POST to /api/verify
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "note build failed" }, { status: 500 });
  }
}
