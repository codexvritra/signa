#!/usr/bin/env node
/**
 * signa-spend — give an Aeon agent a bounded, wallet-signed spending budget.
 *
 * An agent can't safely be handed a wallet, and until now it couldn't ask for
 * money either. This skill closes that: the agent records signed spends against
 * a human-granted mandate (bounded by per-tx + total caps), and when it runs out
 * it wallet-signs a request for more. Every action is EIP-191, re-verifiable.
 *
 * Usage (SIGNA_PRIVATE_KEY = the agent's wallet):
 *   node signa-spend/run.mjs '{"action":"mandates"}'
 *   node signa-spend/run.mjs '{"action":"spend","mandate_id":"...","usdc":"0.04","note":"data pull"}'
 *   node signa-spend/run.mjs '{"action":"ask","grantor":"0x...","usdc":"0.05","goal":"finish the briefing"}'
 */
import { privateKeyToAccount } from "viem/accounts";
import { mkdirSync, writeFileSync } from "node:fs";

const raw = process.argv[2] ?? "{}";
const pk = process.env.SIGNA_PRIVATE_KEY;
const baseUrl = process.env.SIGNA_BASE_URL ?? "https://www.signaagent.xyz";
if (!pk) {
  console.error("SIGNA_PRIVATE_KEY is required (the agent's wallet)");
  process.exit(2);
}
let p;
try {
  p = JSON.parse(raw);
} catch (e) {
  console.error("argument is not valid JSON:", e.message);
  process.exit(2);
}

const account = privateKeyToAccount(pk);
const agent = account.address.toLowerCase();
const toRaw = (usdc) => String(Math.round(Number(usdc) * 1e6));
const fmt = (r) => `${(Number(BigInt(r)) / 1e6).toFixed(2)} USDC`;

const spendPreimage = (ts, mandateId, amount, note) =>
  ["SIGNA spend v1", `ts:${ts}`, `mandate:${mandateId}`, `agent:${agent}`, `amount:${amount}`, `note:${note ?? ""}`].join("\n");
const askPreimage = (ts, grantor, amount, goal, reason) =>
  ["SIGNA budget request v1", `ts:${ts}`, `agent:${agent}`, `grantor:${grantor.toLowerCase()}`, `amount:${amount}`, `goal:${goal ?? ""}`, `reason:${reason ?? ""}`].join("\n");

const out = (s) => {
  process.stdout.write(s.endsWith("\n") ? s : s + "\n");
  try {
    mkdirSync(".outputs", { recursive: true });
    writeFileSync(".outputs/signa-spend.md", s);
  } catch {
    /* soft */
  }
};

try {
  if (p.action === "mandates") {
    const r = await (await fetch(`${baseUrl}/api/mandates?agent=${agent}`)).json();
    const lines = (r.mandates ?? []).map(
      (m) => `· ${m.id.slice(0, 8)} — up to ${fmt(m.limit_raw)} (max ${fmt(m.per_tx_raw)}/buy) from ${m.grantor.slice(0, 10)}`,
    );
    out(`mandates for ${agent}:\n${lines.join("\n") || "(none yet — ask a human to grant one)"}`);
  } else if (p.action === "spend") {
    if (!p.mandate_id || p.usdc == null) {
      console.error('spend needs { mandate_id, usdc, note? }');
      process.exit(2);
    }
    const ts = Date.now();
    const amount = toRaw(p.usdc);
    const signature = await account.signMessage({ message: spendPreimage(ts, p.mandate_id, amount, p.note) });
    const r = await (
      await fetch(`${baseUrl}/api/mandates/spend`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mandate_id: p.mandate_id, agent, amount, note: p.note ?? "", ts, signature }),
      })
    ).json();
    if (r.ok) out(`spent ${fmt(amount)} ✓ — ${fmt(r.remaining_raw)} left on the mandate`);
    else if (r.error === "exceeds_mandate") out(`blocked: only ${fmt(r.remaining_raw)} left (short ${fmt(r.short_by_raw)}). ask the human for more — use action "ask".`);
    else out(`spend rejected: ${r.error}`);
  } else if (p.action === "ask") {
    if (!p.grantor || p.usdc == null) {
      console.error('ask needs { grantor, usdc, goal?, reason? }');
      process.exit(2);
    }
    const ts = Date.now();
    const amount = toRaw(p.usdc);
    const signature = await account.signMessage({ message: askPreimage(ts, p.grantor, amount, p.goal, p.reason) });
    const r = await (
      await fetch(`${baseUrl}/api/requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent, grantor: p.grantor, amount, goal: p.goal ?? "", reason: p.reason ?? "", ts, signature }),
      })
    ).json();
    if (r.ok) out(`asked ${p.grantor.slice(0, 10)} for ${fmt(amount)} more ✓ — request ${r.request.id.slice(0, 8)} (wallet-signed)`);
    else out(`request rejected: ${r.error}`);
  } else {
    console.error('action must be one of: "mandates", "spend", "ask"');
    process.exit(2);
  }
} catch (e) {
  console.error("signa-spend failed:", e.message ?? e);
  process.exit(1);
}
