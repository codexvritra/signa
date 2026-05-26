#!/usr/bin/env node
/**
 * miroshark-stats — read MiroShark sim activity for any SIGNA wallet.
 *
 * Usage:
 *   node run.mjs [ADDRESS]
 */
import { mkdirSync, writeFileSync } from "node:fs";

let address = (process.argv[2] ?? "").trim().toLowerCase();
if (!address) {
  const pk = process.env.SIGNA_PRIVATE_KEY;
  if (!pk) {
    console.error("ADDRESS not provided and SIGNA_PRIVATE_KEY missing.");
    process.exit(2);
  }
  try {
    const { privateKeyToAccount } = await import("viem/accounts");
    const fmt = pk.startsWith("0x") ? pk : `0x${pk}`;
    address = privateKeyToAccount(fmt).address.toLowerCase();
  } catch (e) {
    console.error("viem unavailable + no ADDRESS given:", e.message);
    process.exit(2);
  }
}
if (!/^0x[a-f0-9]{40}$/.test(address)) {
  console.error(`invalid address: ${address}`);
  process.exit(2);
}

const baseUrl = process.env.SIGNA_BASE_URL ?? "https://www.signaagent.xyz";

function fmtTs(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toISOString().replace("T", " ").slice(0, 16); } catch { return iso; }
}

try {
  const r = await fetch(`${baseUrl}/api/agents/${address}/miroshark-stats`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok) {
    throw new Error(data?.error ?? `HTTP ${r.status}`);
  }
  const lines = [
    `MiroShark activity for ${address}`,
    "",
    `sims fired:     ${data.sims_fired ?? 0}`,
    `verdicts:       ${data.verdicts_received ?? 0}`,
  ];
  if (data.last_sim_at) lines.push(`last sim:       ${fmtTs(data.last_sim_at)}`);
  if (Array.isArray(data.recent_verdicts) && data.recent_verdicts.length > 0) {
    lines.push("", "Recent verdicts:");
    for (const v of data.recent_verdicts.slice(0, 5)) {
      const when = fmtTs(v.created_at);
      const body = (v.body ?? "").slice(0, 200);
      lines.push(`  ${when}  verdict: ${body}`);
    }
  }
  const out = lines.join("\n") + "\n";
  process.stdout.write(out);
  try { mkdirSync(".outputs", { recursive: true }); writeFileSync(".outputs/miroshark-stats.md", out); } catch {}
} catch (e) {
  console.error("miroshark-stats failed:", e.message ?? e);
  process.exit(1);
}
