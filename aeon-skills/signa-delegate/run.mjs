#!/usr/bin/env node
/**
 * signa-delegate — find an agent on SIGNA matching a capability, DM
 * them a task, return their wallet-signed reply.
 *
 * Usage:
 *   SIGNA_PRIVATE_KEY=0x... node run.mjs '{"capability":"code","task":"...","wait_ms":60000}'
 */
import { SignaAgent } from "signa-agent";
import { mkdirSync, writeFileSync } from "node:fs";

const raw = process.argv[2];
if (!raw) {
  console.error('usage: node run.mjs \'{"capability":"<tag>","task":"...","wait_ms":60000,"platform":"<optional>"}\'');
  process.exit(2);
}
const pk = process.env.SIGNA_PRIVATE_KEY;
if (!pk) {
  console.error("SIGNA_PRIVATE_KEY is required");
  process.exit(2);
}

let payload;
try { payload = JSON.parse(raw); } catch (e) {
  console.error("DELEGATE is not valid JSON:", e.message); process.exit(2);
}
const { capability, task, wait_ms, platform } = payload ?? {};
if (!capability || !task) {
  console.error('DELEGATE must include { "capability": "<tag>", "task": "..." }'); process.exit(2);
}
const waitMs = Math.min(Math.max(Number(wait_ms ?? 60_000), 1_000), 180_000);

const baseUrl = process.env.SIGNA_BASE_URL ?? "https://www.signaagent.xyz";
const agent = new SignaAgent({ privateKey: pk, baseUrl });

function fmtAddr(a) {
  if (!a || a.length < 10) return a ?? "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

try {
  // 1) discover alive bridges (optionally platform-filtered)
  const bridges = await agent.listBridges({
    ...(platform ? { platform } : {}),
    status: "alive",
    limit: 100,
  });

  // 2) pick the first bridge that declares the requested capability
  const wanted = String(capability).toLowerCase();
  const match = bridges.find((b) =>
    Array.isArray(b.capabilities) &&
    b.capabilities.some((c) => String(c).toLowerCase() === wanted),
  );

  if (!match) {
    const out = [
      `no alive agent matched capability=${capability}${platform ? ` on platform=${platform}` : ""}`,
      "",
      `${bridges.length} alive bridge${bridges.length === 1 ? "" : "s"} were checked.`,
      "Caller should fall back to local handling.",
    ].join("\n");
    process.stdout.write(out);
    try { mkdirSync(".outputs", { recursive: true }); writeFileSync(".outputs/signa-delegate.md", out); } catch {}
    process.exit(0);
  }

  // 3) send the task
  const cutoffMs = Date.now();
  const sent = await agent.send(match.bridge_address, task);
  const target = match.bridge_address.toLowerCase();

  // 4) poll inbox until reply or timeout
  const deadline = Date.now() + waitMs;
  let reply = null;
  while (Date.now() < deadline) {
    const inbox = await agent.inbox({ limit: 20, from: target });
    for (const dm of inbox) {
      if (dm.ts && dm.ts > cutoffMs && dm.from.toLowerCase() === target) {
        reply = dm;
        break;
      }
    }
    if (reply) break;
    await new Promise((r) => setTimeout(r, 2_000));
  }

  const elapsedMs = Date.now() - cutoffMs;
  const lines = [];
  lines.push(
    `delegated to [${match.platform}/${match.platform_model}] ${fmtAddr(match.bridge_address)}`,
    `  capability matched: ${capability}`,
    `  task: ${task.length > 120 ? task.slice(0, 117) + "..." : task}`,
    `  sent dm: ${sent.id}`,
  );
  if (reply) {
    lines.push(`  reply received after ${elapsedMs}ms`);
    lines.push("");
    lines.push("reply body:");
    lines.push(reply.body);
    lines.push("");
    lines.push(`verify: ${baseUrl}/api/dm/${reply.id}`);
  } else {
    lines.push(`  (no reply within ${waitMs}ms)`);
  }
  const out = lines.join("\n");
  process.stdout.write(out);
  try {
    mkdirSync(".outputs", { recursive: true });
    writeFileSync(".outputs/signa-delegate.md", out);
  } catch {}
} catch (e) {
  console.error("signa-delegate failed:", e.message ?? e);
  process.exit(1);
}
