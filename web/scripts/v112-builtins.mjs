/**
 * v2.3 — verify the new keyless built-in capabilities live, with signature
 * re-verification. Invokes each via the public gateway, asserts real data,
 * and re-verifies the gateway's EIP-191 attestation over the output.
 *
 *   node scripts/v112-builtins.mjs
 */
import { createHash } from "node:crypto";
import { verifyMessage } from "viem";

const BASE = process.env.SIGNA_BASE ?? "https://www.signaagent.xyz";
let fails = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL ") + m); if (!c) fails++; };
const resultPreimage = (cap, input, prov, ts, output) =>
  ["SIGNA capability result v1", `cap:${cap}`, `input:${input}`, `provider:${prov}`, `ts:${ts}`, `output:${createHash("sha256").update(JSON.stringify(output)).digest("hex")}`].join("\n");

async function invoke(cap, arg = "") {
  const r = await fetch(`${BASE}/api/capabilities/invoke?cap=${encodeURIComponent(cap)}${arg ? `&arg=${encodeURIComponent(arg)}` : ""}`, { headers: { accept: "application/json" } });
  return r.json();
}
async function reverify(j) {
  try {
    return j?.signature && j?.gateway
      ? await verifyMessage({ address: j.gateway, message: resultPreimage(j.capability, j.input ?? "", j.provider, j.ts, j.output), signature: j.signature })
      : false;
  } catch { return false; }
}

console.log(`verifying the new keyless built-ins on ${BASE}\n`);
const cases = [
  { cap: "token.price", arg: "ethereum", check: (o) => typeof o?.price_usd === "number", show: (o) => `ETH ≈ $${Math.round(o.price_usd)}` },
  { cap: "token.price", arg: "bitcoin", check: (o) => typeof o?.price_usd === "number", show: (o) => `BTC ≈ $${Math.round(o.price_usd)}` },
  { cap: "base.gas", arg: "", check: (o) => typeof o?.gas_price_gwei === "number", show: (o) => `${o.gas_price_gwei} gwei` },
  { cap: "base.block", arg: "", check: (o) => typeof o?.number === "number" && o.number > 0, show: (o) => `block #${o.number}` },
  { cap: "defi.tvl", arg: "aave", check: (o) => typeof o?.tvl_usd === "number", show: (o) => `aave TVL $${(o.tvl_usd / 1e9).toFixed(1)}B` },
];

for (const c of cases) {
  const j = await invoke(c.cap, c.arg);
  const good = j?.ok && c.check(j.output);
  const verified = good ? await reverify(j) : false;
  ok(good && verified, `${c.cap}${c.arg ? `(${c.arg})` : ""} → ${good ? c.show(j.output) : (j?.error ?? "failed")}${good ? (verified ? " · signature re-verified" : " · SIG FAILED") : ""}`);
}

// also confirm a bad arg is handled cleanly (pro: error paths matter)
const bad = await invoke("defi.tvl", "this-protocol-does-not-exist-xyz");
ok(bad?.ok === false, `defi.tvl(bogus) → clean error: ${bad?.error ?? "(no error field)"}`);

console.log(fails === 0 ? "\n✓ all new built-ins return real data + a re-verifiable signed result; error paths clean" : `\n✗ ${fails} failed`);
process.exit(fails > 0 ? 1 : 0);
