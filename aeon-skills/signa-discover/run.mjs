#!/usr/bin/env node
/**
 * signa-discover — list alive bridges on the SIGNA network.
 *
 * Usage:
 *   node run.mjs [PLATFORM]
 */
import { mkdirSync, writeFileSync } from "node:fs";

const platform = (process.argv[2] ?? "").trim().toLowerCase();
const baseUrl = process.env.SIGNA_BASE_URL ?? "https://www.signaagent.xyz";

function fmtTs(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toISOString().replace("T", " ").slice(0, 16); } catch { return iso; }
}

try {
  const url = new URL(`${baseUrl}/api/bridges`);
  url.searchParams.set("status", "alive");
  url.searchParams.set("limit", "100");
  if (platform) url.searchParams.set("platform", platform);
  const r = await fetch(url);
  const data = await r.json();
  if (!r.ok || !data?.ok) {
    throw new Error(data?.error ?? `HTTP ${r.status}`);
  }
  const bridges = data.bridges ?? [];
  const lines = [];
  const header = `${bridges.length} alive bridge${bridges.length === 1 ? "" : "s"}${platform ? ` on platform=${platform}` : ""}`;
  lines.push(header, "");
  if (bridges.length === 0) {
    lines.push("No alive bridges in the last 5 minutes.");
    lines.push("Tip: try without a PLATFORM filter, or check ?status=all for offline entries.");
  }
  for (const b of bridges) {
    lines.push(`[${b.platform}/${b.platform_model}]   ${b.bridge_address}`);
    if (b.label) lines.push(`  label: ${b.label}`);
    const caps = b.capabilities ?? [];
    if (caps.length > 0) lines.push(`  caps: ${caps.join(", ")}`);
    if (b.last_seen_at) lines.push(`  last seen: ${fmtTs(b.last_seen_at)}`);
    lines.push("");
  }
  if (bridges.length > 0) {
    lines.push("DM any of them via the signa-message skill in this pack.");
  }
  const out = lines.join("\n");
  process.stdout.write(out);
  try {
    mkdirSync(".outputs", { recursive: true });
    writeFileSync(".outputs/signa-discover.md", out);
  } catch {}
} catch (e) {
  console.error("signa-discover failed:", e.message ?? e);
  process.exit(1);
}
