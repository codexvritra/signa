#!/usr/bin/env node
/**
 * signa-b20 — the verifiable toolkit for Base's native B20 token standard.
 *
 * One skill, four verifiable B20 actions, every one wallet-signed + re-checkable:
 *   • launch   — prepare a B20 token launch (calldata your wallet broadcasts + a signed receipt)
 *   • pay      — pay with an unforgeable note (transferWithMemo; the memo commits to a signed note)
 *   • reserves — publish a stablecoin reserve attestation anyone can verify
 *   • info     — read any B20 token's metadata + on-chain isB20 check
 *
 * SIGNA never custodies funds — your wallet broadcasts; SIGNA proves the action.
 *
 * Usage (SIGNA_PRIVATE_KEY = the agent's wallet):
 *   node signa-b20/run.mjs '{"action":"info","address":"0x…"}'
 *   node signa-b20/run.mjs '{"action":"launch","name":"My Token","symbol":"MYT","variant":"ASSET","decimals":18}'
 *   node signa-b20/run.mjs '{"action":"pay","token":"0x…","to":"0x…","amount":"1000000","note":"invoice #42"}'
 *   node signa-b20/run.mjs '{"action":"reserves","token":"0x…","amount":"1000000.00","asset":"USDC","statement":"backed 1:1 by USDC"}'
 */
import { privateKeyToAccount } from "viem/accounts";
import { mkdirSync, writeFileSync } from "node:fs";

const raw = process.argv[2] ?? "{}";
const pk = process.env.SIGNA_PRIVATE_KEY;
const baseUrl = process.env.SIGNA_BASE_URL ?? "https://www.signaagent.xyz";
if (!pk) { console.error("SIGNA_PRIVATE_KEY is required (the agent's wallet)"); process.exit(2); }
let p; try { p = JSON.parse(raw); } catch (e) { console.error("argument is not valid JSON:", e.message); process.exit(2); }

const account = privateKeyToAccount(pk);
const agent = account.address.toLowerCase();
const isAddr = (a) => /^0x[a-fA-F0-9]{40}$/.test(a ?? "");
const post = async (path, body) => (await fetch(`${baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
const bytes = (d) => ((d?.length ?? 2) - 2) / 2;
const out = (s) => { process.stdout.write(s.endsWith("\n") ? s : s + "\n"); try { mkdirSync(".outputs", { recursive: true }); writeFileSync(".outputs/signa-b20.md", s); } catch {} };

try {
  if (p.action === "info") {
    if (!isAddr(p.address)) { console.error("info needs { address }"); process.exit(2); }
    const r = await (await fetch(`${baseUrl}/api/b20?address=${p.address.toLowerCase()}`)).json();
    if (!r.ok) { out(`info failed: ${r.error}`); process.exit(1); }
    out(`B20 token ${r.address}\n  ${r.name ?? "—"} (${r.symbol ?? "—"}) · ${r.decimals ?? "?"} decimals\n  supply ${r.total_supply_raw ?? "—"}\n  is B20: ${r.is_b20_confirmed_onchain ? "yes (on-chain)" : r.is_b20 ? "likely (by prefix)" : "no"}`);

  } else if (p.action === "launch") {
    if (!p.name || !p.symbol) { console.error('launch needs { name, symbol, variant?, decimals?, currency? }'); process.exit(2); }
    const r = await post("/api/b20", { variant: p.variant ?? "ASSET", name: p.name, symbol: p.symbol, creator: agent, decimals: p.decimals, currency: p.currency });
    if (!r.ok) { out(`launch prepare failed: ${r.error}`); process.exit(1); }
    out(`B20 launch prepared — ${r.receipt.name} (${r.receipt.symbol}), variant ${r.receipt.variant}\n  predicted address: ${r.predicted_address ?? "(needs a Beryl-aware RPC)"}\n  broadcast to ${r.tx.to} — createB20 calldata (${bytes(r.tx.data)} bytes)\n  signed receipt by ${r.receipt.signer} — re-verify kind b20_launch\n  → your wallet broadcasts the mint; SIGNA proves the launch.`);

  } else if (p.action === "pay") {
    if (!isAddr(p.token) || !isAddr(p.to) || p.amount == null || !p.note) { console.error('pay needs { token, to, amount, note }'); process.exit(2); }
    const b = await post("/api/b20/note", { token: p.token, to: p.to, amount: String(p.amount), note: p.note, from: agent });
    if (!b.ok) { out(`pay build failed: ${b.error}`); process.exit(1); }
    const signature = await account.signMessage({ message: b.preimage });
    const v = await post("/api/verify", { ...b.reverify, signature });
    out(`B20 money-note signed — "${p.note}"\n  pay ${p.amount} (raw) to ${p.to}\n  on-chain memo ${b.memo}\n  broadcast transferWithMemo to ${b.tx.to} (${bytes(b.tx.data)} bytes)\n  verify (kind b20_memo): valid=${v.valid} recovers=${v.recovered}\n  → your wallet broadcasts the payment; the note recovers to you, bound on-chain.`);

  } else if (p.action === "reserves") {
    if (!isAddr(p.token) || p.amount == null || !p.asset || !p.statement) { console.error('reserves needs { token, amount, asset, statement }'); process.exit(2); }
    const b = await post("/api/b20/reserves", { token: p.token, issuer: agent, reserve_amount: String(p.amount), reserve_asset: p.asset, statement: p.statement });
    if (!b.ok) { out(`reserves build failed: ${b.error}`); process.exit(1); }
    const signature = await account.signMessage({ message: b.preimage });
    const v = await post("/api/verify", { ...b.reverify, signature });
    out(`B20 reserve attestation signed — ${p.amount} ${p.asset}\n  stablecoin ${p.token}\n  "${p.statement}"\n  verify (kind b20_reserves): valid=${v.valid} issuer=${v.recovered}\n  → a timestamped reserve statement anyone can re-check (provenance, not an audit).`);

  } else if (p.action === "verify") {
    if (!p.artifact || typeof p.artifact !== "object") { console.error('verify needs { artifact: { kind, …, signature } }'); process.exit(2); }
    const v = await post("/api/verify", p.artifact);
    out(`verify ${v.kind}: valid=${v.valid} recovered=${v.recovered} (${v.signer_role})`);

  } else {
    console.error('action must be one of: "info", "launch", "pay", "reserves", "verify"');
    process.exit(2);
  }
} catch (e) {
  console.error("signa-b20 failed:", e.message ?? e);
  process.exit(1);
}
