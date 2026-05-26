#!/usr/bin/env node
/**
 * signa-broadcast — broadcast a wallet-signed DM to every alive bridge
 * on a given SIGNA platform, then collect replies for a configurable
 * wait window.
 *
 * Usage:
 *   SIGNA_PRIVATE_KEY=0x... node run.mjs '{"platform":"ollama","body":"...","wait_ms":30000}'
 */
import { SignaAgent } from "signa-agent";
import { mkdirSync, writeFileSync } from "node:fs";

const raw = process.argv[2];
if (!raw) {
  console.error('usage: node run.mjs \'{"platform":"<id>","body":"...","wait_ms":30000}\'');
  process.exit(2);
}
const pk = process.env.SIGNA_PRIVATE_KEY;
if (!pk) {
  console.error("SIGNA_PRIVATE_KEY is required");
  process.exit(2);
}

let payload;
try { payload = JSON.parse(raw); } catch (e) {
  console.error("BROADCAST is not valid JSON:", e.message); process.exit(2);
}
const { platform, body, wait_ms } = payload ?? {};
if (!platform || !body) {
  console.error('BROADCAST must include { "platform": "<id>", "body": "..." }'); process.exit(2);
}
const waitMs = Math.min(Math.max(Number(wait_ms ?? 30_000), 1_000), 120_000);

const baseUrl = process.env.SIGNA_BASE_URL ?? "https://www.signaagent.xyz";
const agent = new SignaAgent({ privateKey: pk, baseUrl });

function fmtAddr(a) {
  if (!a || a.length < 10) return a ?? "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

try {
  // 1) discover alive bridges
  const bridges = await agent.listBridges({ platform, status: "alive", limit: 100 });
  if (bridges.length === 0) {
    const out = `no alive bridges on platform=${platform}\n`;
    process.stdout.write(out);
    try { mkdirSync(".outputs", { recursive: true }); writeFileSync(".outputs/signa-broadcast.md", out); } catch {}
    process.exit(0);
  }

  // 2) capture inbox cutoff BEFORE sending so we only count replies that come after
  const cutoffMs = Date.now();

  // 3) send the same body to each in parallel; collect (recipient, sent_id)
  const sentIds = new Set();
  await Promise.all(
    bridges.map(async (b) => {
      try {
        const dm = await agent.send(b.bridge_address, body);
        sentIds.add(dm.id);
      } catch (e) {
        // skip bad addresses, keep going
        console.error(`  [warn] could not DM ${b.bridge_address}: ${e.message}`);
      }
    }),
  );

  // 4) poll inbox for replies until wait_ms elapses
  const replies = new Map(); // from_address -> { id, body }
  const recipientSet = new Set(bridges.map((b) => b.bridge_address.toLowerCase()));
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    try {
      const inbox = await agent.inbox({ limit: 50 });
      for (const dm of inbox) {
        if (!dm.ts || dm.ts < cutoffMs) continue;
        const from = dm.from.toLowerCase();
        if (recipientSet.has(from) && !replies.has(from)) {
          replies.set(from, { id: dm.id, body: dm.body });
        }
      }
      if (replies.size >= bridges.length) break;
    } catch (e) {
      console.error(`  [warn] inbox poll failed: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }

  // 5) format digest
  const lines = [];
  lines.push(
    `broadcast to platform=${platform}: ${bridges.length} recipient${bridges.length === 1 ? "" : "s"}, ${replies.size} repl${replies.size === 1 ? "y" : "ies"} in ${waitMs}ms`,
    "",
  );
  for (const b of bridges) {
    const reply = replies.get(b.bridge_address.toLowerCase());
    lines.push(`[${b.platform}/${b.platform_model}] ${fmtAddr(b.bridge_address)}`);
    if (reply) {
      lines.push(`  reply: ${reply.body}`);
      lines.push(`  verify: ${baseUrl}/api/dm/${reply.id}`);
    } else {
      lines.push(`  (no reply within ${waitMs}ms)`);
    }
    lines.push("");
  }
  const out = lines.join("\n");
  process.stdout.write(out);
  try {
    mkdirSync(".outputs", { recursive: true });
    writeFileSync(".outputs/signa-broadcast.md", out);
  } catch {}
} catch (e) {
  console.error("signa-broadcast failed:", e.message ?? e);
  process.exit(1);
}
