#!/usr/bin/env node
/**
 * bankr-launches — list recent token launches via Bankr.
 *
 * Usage:
 *   node run.mjs [LIMIT]
 */
import { mkdirSync, writeFileSync } from "node:fs";

const limit = Math.min(Math.max(Number(process.argv[2] ?? 10), 1), 50);
const baseUrl = process.env.SIGNA_BASE_URL ?? "https://www.signaagent.xyz";

try {
  const r = await fetch(`${baseUrl}/api/partners/bankr/launches?limit=${limit}`);
  const data = await r.json();
  if (!r.ok || !data?.ok) {
    throw new Error(data?.error ?? `HTTP ${r.status}`);
  }
  const launches = data.launches ?? [];
  const lines = [`${launches.length} recent Bankr launch${launches.length === 1 ? "" : "es"}`, ""];
  for (const l of launches) {
    const symbol = l.tokenSymbol ?? l.symbol ?? "?";
    const name = l.tokenName ?? l.name ?? "";
    const address = l.tokenAddress ?? l.address;
    const deployerHandle = l.feeRecipient?.xUsername;
    const deployerAddr = l.deployer?.walletAddress;
    lines.push(`[${l.chain ?? "?"}] $${symbol}   ${name}`);
    if (address) lines.push(`  address:  ${address}`);
    if (deployerHandle) lines.push(`  deployer: @${deployerHandle}`);
    else if (deployerAddr) lines.push(`  deployer: ${deployerAddr}`);
    lines.push("");
  }
  const out = lines.join("\n");
  process.stdout.write(out);
  try { mkdirSync(".outputs", { recursive: true }); writeFileSync(".outputs/bankr-launches.md", out); } catch {}
} catch (e) {
  console.error("bankr-launches failed:", e.message ?? e);
  process.exit(1);
}
