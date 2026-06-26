// Live prod check for B20 money-notes: wait for /api/b20/note, build a note, sign it as the
// payer (test key), re-verify via /api/verify (kind b20_memo). No gas, no wallet UI.
import { recoverMessageAddress } from "viem"; // (unused but keeps viem import parity)
import { privateKeyToAccount } from "viem/accounts";
const BASE = process.env.BASE ?? "https://www.signaagent.xyz";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const payer = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");

const spec = { token: "0xb2000000000000000000007ad5e0c47f47b5a908", to: "0x95fce75729690477e48820805c74602338e19303", amount: "1500000", note: "invoice #42 — paid in full 🫡", from: payer.address.toLowerCase() };
// poll the POST until the new route returns JSON (deployed), not the 404 HTML page
let bj = null;
for (let i = 0; i < 40; i++) {
  try {
    const r = await fetch(`${BASE}/api/b20/note`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(spec) });
    if ((r.headers.get("content-type") || "").includes("application/json")) { bj = await r.json(); if (bj?.ok) break; }
  } catch {}
  process.stdout.write(`. (${i})`);
  await sleep(8000);
}
if (!bj?.ok) { console.log("\nBUILD FAILED / not deployed:", bj); process.exit(1); }
console.log("\n/api/b20/note is live");
const signature = await payer.signMessage({ message: bj.preimage });
const vj = await (await fetch(`${BASE}/api/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...bj.reverify, signature }) })).json();

console.log("\nnote:           ", JSON.stringify(spec.note));
console.log("on-chain memo:  ", bj.memo);
console.log("transferWithMemo to:", bj.tx?.to, " bytes:", ((bj.tx?.data?.length ?? 2) - 2) / 2);
console.log("verify kind:    ", vj.kind);
console.log("valid:          ", vj.valid);
console.log("recovered payer:", vj.recovered, "(expected", payer.address.toLowerCase() + ")");
const ok = vj.valid === true && vj.recovered === payer.address.toLowerCase();
console.log(ok ? "\n✅ LIVE ON PROD — B20 money-note recovers to the payer" : "\n❌ did not pass");
process.exit(ok ? 0 : 1);
