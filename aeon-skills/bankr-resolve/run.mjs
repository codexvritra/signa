#!/usr/bin/env node
/**
 * bankr-resolve — resolve a handle to its wallet via Bankr.
 *
 * Usage:
 *   node run.mjs "vitalik.eth"
 *   node run.mjs '{"value":"@vitalikbuterin","type":"twitter"}'
 */
import { mkdirSync, writeFileSync } from "node:fs";

const raw = (process.argv[2] ?? "").trim();
if (!raw) {
  console.error('usage: node run.mjs <handle>');
  process.exit(2);
}
let value = raw, type;
if (raw.startsWith("{")) {
  try {
    const j = JSON.parse(raw);
    value = String(j.value ?? "");
    if (j.type) type = String(j.type);
  } catch {
    // treat as plain string
  }
}
if (!value) {
  console.error('handle is empty'); process.exit(2);
}

const baseUrl = process.env.SIGNA_BASE_URL ?? "https://www.signaagent.xyz";
const url = new URL(`${baseUrl}/api/partners/bankr/resolve`);
url.searchParams.set("value", value);
if (type) url.searchParams.set("type", type);

try {
  const r = await fetch(url);
  const data = await r.json();
  if (r.status === 404 || !data?.ok) {
    const out = `bankr did not resolve "${value}"${type ? ` (type=${type})` : ""}\n`;
    process.stdout.write(out);
    try { mkdirSync(".outputs", { recursive: true }); writeFileSync(".outputs/bankr-resolve.md", out); } catch {}
    process.exit(0);
  }
  const res = data.resolution ?? {};
  const lines = [`resolved "${value}"`];
  if (res.address) lines.push(`address: ${res.address}`);
  if (res.type) lines.push(`type: ${res.type}`);
  for (const [k, v] of Object.entries(res)) {
    if (k === "address" || k === "type") continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      lines.push(`${k}: ${v}`);
    }
  }
  const out = lines.join("\n") + "\n";
  process.stdout.write(out);
  try { mkdirSync(".outputs", { recursive: true }); writeFileSync(".outputs/bankr-resolve.md", out); } catch {}
} catch (e) {
  console.error("bankr-resolve failed:", e.message ?? e);
  process.exit(1);
}
