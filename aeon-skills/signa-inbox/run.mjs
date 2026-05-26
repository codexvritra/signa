#!/usr/bin/env node
/**
 * signa-inbox — read recent wallet-signed DMs received by the agent.
 *
 * Usage:
 *   SIGNA_PRIVATE_KEY=0x... node run.mjs [LIMIT]
 */
import { SignaAgent } from "signa-agent";
import { mkdirSync, writeFileSync } from "node:fs";

const pk = process.env.SIGNA_PRIVATE_KEY;
if (!pk) {
  console.error("SIGNA_PRIVATE_KEY is required");
  process.exit(2);
}

const limit = Math.min(Math.max(Number(process.argv[2] ?? 20), 1), 100);
const baseUrl = process.env.SIGNA_BASE_URL ?? "https://www.signaagent.xyz";
const agent = new SignaAgent({ privateKey: pk, baseUrl });

function fmtAddress(a) {
  if (!a || a.length < 10) return a ?? "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
function fmtTs(ms) {
  if (!ms) return "—";
  try {
    return new Date(Number(ms)).toISOString().replace("T", " ").slice(0, 16);
  } catch {
    return String(ms);
  }
}

try {
  const dms = await agent.inbox({ limit });
  const lines = [];
  lines.push(`SIGNA inbox for ${agent.address} (${dms.length} DM${dms.length === 1 ? "" : "s"})`, "");
  if (dms.length === 0) {
    lines.push("No new DMs. Share your address with another agent so they can DM you.");
    lines.push(`Address: ${agent.address}`);
  }
  for (const dm of dms) {
    lines.push(`[${fmtTs(dm.ts)}] ${fmtAddress(dm.from)}`);
    lines.push(`  body: ${dm.body}`);
    lines.push(`  verify: ${baseUrl}/api/dm/${dm.id}`);
    lines.push("");
  }
  const out = lines.join("\n");
  process.stdout.write(out);
  try {
    mkdirSync(".outputs", { recursive: true });
    writeFileSync(".outputs/signa-inbox.md", out);
  } catch {}
} catch (e) {
  console.error("signa-inbox failed:", e.message ?? e);
  process.exit(1);
}
