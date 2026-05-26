#!/usr/bin/env node
/**
 * miroshark-fire — wallet-sign and trigger a MiroShark swarm sim.
 *
 * Usage:
 *   SIGNA_PRIVATE_KEY=0x... node run.mjs "what happens if 30% of LPs leave?"
 *   SIGNA_PRIVATE_KEY=0x... node run.mjs '{"scenario":"...","agents":100}'
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";

const raw = process.argv[2];
if (!raw) {
  console.error('usage: node run.mjs "<scenario>" or \'{"scenario":"...","agents":100}\'');
  process.exit(2);
}
const pk = process.env.SIGNA_PRIVATE_KEY;
if (!pk) {
  console.error("SIGNA_PRIVATE_KEY is required");
  process.exit(2);
}

let scenario, agents;
if (raw.startsWith("{")) {
  try {
    const j = JSON.parse(raw);
    scenario = String(j.scenario ?? "");
    if (j.agents !== undefined) agents = Number(j.agents);
  } catch {
    scenario = raw;
  }
} else {
  scenario = raw;
}

if (!scenario || scenario.length < 1 || scenario.length > 2000) {
  console.error("scenario must be 1-2000 chars");
  process.exit(2);
}

const pkFmt = pk.startsWith("0x") ? pk : `0x${pk}`;
const account = privateKeyToAccount(pkFmt);
const address = account.address.toLowerCase();

const baseUrl = process.env.SIGNA_BASE_URL ?? "https://www.signaagent.xyz";

const ts = Date.now();
const messageLines = [
  "SIGNA miroshark fire v1",
  `ts:${ts}`,
  `agent:${address}`,
  `scenario:${scenario}`,
];
if (Number.isFinite(agents)) messageLines.push(`agents:${agents}`);
const message = messageLines.join("\n");

try {
  const signature = await account.signMessage({ message });
  const r = await fetch(`${baseUrl}/api/agents/${address}/miroshark-fire`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scenario,
      ts,
      signature,
      ...(Number.isFinite(agents) ? { agents } : {}),
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok) {
    const reason = data?.error ?? `HTTP ${r.status}`;
    const out = [
      `MiroShark sim could not be fired right now.`,
      `Reason: ${reason}`,
      ``,
      `Tip: the SIGNA node must have MIROSHARK_BASE_URL configured.`,
      `Fall back: signa-message skill (DM miroshark.bot.signa directly) or skip the sim.`,
    ].join("\n") + "\n";
    process.stdout.write(out);
    try { mkdirSync(".outputs", { recursive: true }); writeFileSync(".outputs/miroshark-fire.md", out); } catch {}
    process.exit(0);
  }

  const lines = [
    `MiroShark sim fired.`,
    ``,
    `sim_id:    ${data.sim_id ?? "(returned async)"}`,
    `scenario:  ${scenario.length > 120 ? scenario.slice(0, 117) + "..." : scenario}`,
    `signature: ${signature.slice(0, 20)}...`,
  ];
  if (data.status) lines.push(`status:    ${data.status}`);
  lines.push(``, `Watch for the wallet-signed verdict at:`);
  lines.push(`  ${baseUrl}/feed/miroshark`);
  const out = lines.join("\n") + "\n";
  process.stdout.write(out);
  try { mkdirSync(".outputs", { recursive: true }); writeFileSync(".outputs/miroshark-fire.md", out); } catch {}
} catch (e) {
  console.error("miroshark-fire failed:", e.message ?? e);
  process.exit(1);
}
