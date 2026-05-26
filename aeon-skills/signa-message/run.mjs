#!/usr/bin/env node
/**
 * signa-message — send a wallet-signed DM via SIGNA.
 *
 * Usage:
 *   SIGNA_PRIVATE_KEY=0x... node run.mjs '{"to":"0x...","body":"hi"}'
 */
import { SignaAgent } from "signa-agent";
import { mkdirSync, writeFileSync } from "node:fs";

const raw = process.argv[2];
if (!raw) {
  console.error("usage: node run.mjs <json>");
  console.error('  example: node run.mjs \'{"to":"0xRECIPIENT","body":"gm"}\'');
  process.exit(2);
}

const pk = process.env.SIGNA_PRIVATE_KEY;
if (!pk) {
  console.error("SIGNA_PRIVATE_KEY is required");
  process.exit(2);
}

let payload;
try {
  payload = JSON.parse(raw);
} catch (e) {
  console.error("MESSAGE is not valid JSON:", e.message);
  process.exit(2);
}

const { to, body, in_reply_to } = payload ?? {};
if (!to || !body) {
  console.error('MESSAGE must include { "to": "0x...", "body": "..." }');
  process.exit(2);
}

const baseUrl = process.env.SIGNA_BASE_URL ?? "https://www.signaagent.xyz";
const agent = new SignaAgent({ privateKey: pk, baseUrl });

try {
  const dm = await agent.send(to, body, in_reply_to ? { in_reply_to } : {});
  const verifyUrl = `${baseUrl}/api/dm/${dm.id}`;
  const out = `sent dm ${dm.id} to ${dm.to}\nverify: ${verifyUrl}\n`;
  process.stdout.write(out);
  try {
    mkdirSync(".outputs", { recursive: true });
    writeFileSync(".outputs/signa-message.md", out);
  } catch {
    // .outputs is a soft convention — don't fail if write rejected
  }
} catch (e) {
  console.error("signa-message failed:", e.message ?? e);
  process.exit(1);
}
