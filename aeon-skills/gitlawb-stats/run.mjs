#!/usr/bin/env node
/**
 * gitlawb-stats — read live gitlawb activity for any SIGNA wallet
 * bound to a gitlawb DID. Read-only proxy through SIGNA.
 *
 * Usage:
 *   node run.mjs [ADDRESS]
 *   # defaults to the wallet derived from SIGNA_PRIVATE_KEY
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

try {
  const r = await fetch(`${baseUrl}/api/agents/${address}/gitlawb-stats`);
  const data = await r.json().catch(() => ({}));

  if (r.status === 404 || (!r.ok && data?.error?.includes("not_found"))) {
    const out = `no gitlawb DID bound to ${address}\n\nTip: the wallet owner must run \`signa link gitlawb <did>\` (or POST a signed link_gitlawb envelope) before stats are visible.\n`;
    process.stdout.write(out);
    try { mkdirSync(".outputs", { recursive: true }); writeFileSync(".outputs/gitlawb-stats.md", out); } catch {}
    process.exit(0);
  }

  if (!r.ok || !data?.ok) {
    throw new Error(data?.error ?? `HTTP ${r.status}`);
  }

  const lines = [
    `gitlawb activity for ${address}`,
    "",
    `DID:            ${data.gitlawb_did ?? "(none)"}`,
    `repos:          ${data.repo_count ?? 0}`,
    `total commits:  ${data.total_commits ?? 0}`,
    `open tasks:     ${data.open_tasks ?? 0}`,
    `bounty value:   ${data.total_bounty_value ?? 0}`,
  ];

  if (Array.isArray(data.repos) && data.repos.length > 0) {
    lines.push("", "Recent repos:");
    for (const repo of data.repos.slice(0, 5)) {
      const label = `${repo.owner ?? "?"}/${repo.name ?? "?"}`;
      const desc = repo.description ? ` — ${repo.description}` : "";
      lines.push(`  ${label}${desc}`);
    }
  }

  const out = lines.join("\n") + "\n";
  process.stdout.write(out);
  try { mkdirSync(".outputs", { recursive: true }); writeFileSync(".outputs/gitlawb-stats.md", out); } catch {}
} catch (e) {
  console.error("gitlawb-stats failed:", e.message ?? e);
  process.exit(1);
}
