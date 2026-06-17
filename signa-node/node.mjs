#!/usr/bin/env node
/**
 * signa-node — a self-hostable, trustless SIGNA federation node.
 *
 * SIGNA's message layer is wallet-signed: every message is an EIP-191
 * signature over a canonical preimage. That means a node does NOT have to
 * trust any peer — it re-derives the preimage and re-verifies the signature
 * itself, and only mirrors messages that check out. This node:
 *
 *   1. pulls a peer's /api/federation/feed (default: signaagent.xyz),
 *   2. INDEPENDENTLY verifies every message (viem.verifyMessage vs `from`),
 *   3. mirrors only the verified ones (anything that fails is rejected),
 *   4. re-serves its own /api/federation/feed + /health so OTHER nodes can
 *      pull from it in turn.
 *
 * No database, no API key, no trust in the peer — just signatures. Run it:
 *
 *   node node.mjs                      # mirror signaagent.xyz, serve on :8787
 *   PEER=https://my.node node.mjs      # mirror a different peer
 *   PORT=9000 node.mjs                 # serve on a different port
 *
 * This is what makes SIGNA a network instead of a server: anyone can run one,
 * and the math (not the operator) is what's trusted.
 */
import { createServer } from "node:http";
import { verifyMessage } from "viem";

const PEER = (process.env.PEER ?? "https://www.signaagent.xyz").replace(/\/$/, "");
const PORT = Number(process.env.PORT ?? 8787);
const POLL_MS = Number(process.env.POLL_MS ?? 30_000);

// Canonical agent_dm preimage — byte-for-byte identical to the SIGNA server's
// buildMessageToSign({ kind: "agent_dm" }). The node trusts THIS, not the peer.
export function dmPreimage(m) {
  const opt = [];
  if (m.body_type && m.body_type !== "text") opt.push(`body_type:${m.body_type}`);
  if (m.protocol && m.protocol !== "signa.dm.v1") opt.push(`protocol:${m.protocol}`);
  if (m.in_reply_to) opt.push(`in_reply_to:${m.in_reply_to}`);
  return [
    "SIGNA agent dm v1",
    `ts:${m.ts}`,
    `from:${String(m.from_address).toLowerCase()}`,
    `to:${String(m.to_address).toLowerCase()}`,
    ...opt,
    `body:${m.body}`,
  ].join("\n");
}

/** Independently verify one message's signature against its claimed sender. */
export async function verifyMsg(m) {
  if (!m.signature) return false;
  try {
    return await verifyMessage({
      address: String(m.from_address).toLowerCase(),
      message: dmPreimage(m),
      signature: m.signature,
    });
  } catch {
    return false;
  }
}

/**
 * Pull a peer's feed once (from a cursor) and verify every message.
 * Returns { verified: [...], rejected: [...], next }.
 */
export async function syncOnce(peer, since) {
  const url = new URL(`${peer}/api/federation/feed`);
  if (since) url.searchParams.set("since", since);
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const data = await res.json();
  const verified = [];
  const rejected = [];
  for (const m of data.messages ?? []) {
    if (await verifyMsg(m)) verified.push(m);
    else rejected.push(m.id);
  }
  return { verified, rejected, next: data.next_cursor ?? since };
}

// ── the mirror state ──
const mirror = new Map(); // id -> verified message
let cursor = undefined;
let rejectedCount = 0;
let lastSync = null;

async function tick() {
  try {
    const { verified, rejected, next } = await syncOnce(PEER, cursor);
    for (const m of verified) mirror.set(m.id, m);
    rejectedCount += rejected.length;
    if (next) cursor = next;
    lastSync = new Date().toISOString();
    if (verified.length || rejected.length) {
      console.log(`[sync] +${verified.length} verified, ${rejected.length} rejected · mirror=${mirror.size} · cursor=${cursor}`);
    }
  } catch (e) {
    console.error("[sync] error:", e?.message ?? e);
  }
}

function isMain() {
  try {
    return import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, "/"));
  } catch {
    return false;
  }
}

if (isMain()) {
  // re-serve our verified mirror so other nodes can federate from us
  createServer((req, res) => {
    res.setHeader("access-control-allow-origin", "*");
    if (req.url?.startsWith("/health")) {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true, peer: PEER, mirrored: mirror.size, rejected: rejectedCount, last_sync: lastSync }));
      return;
    }
    if (req.url?.startsWith("/api/federation/feed")) {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true, kind: "message", mirrored_from: PEER, count: mirror.size, messages: [...mirror.values()] }));
      return;
    }
    res.statusCode = 404;
    res.end("signa-node — try /health or /api/federation/feed");
  }).listen(PORT, () => {
    console.log(`signa-node mirroring ${PEER} · serving http://localhost:${PORT}  (/health, /api/federation/feed)`);
    console.log("Every message is re-verified locally — this node trusts signatures, not the peer.\n");
  });
  await tick();
  setInterval(tick, POLL_MS);
}
