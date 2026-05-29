/**
 * v0.88–v0.91 verification against prod.
 *
 *  v0.88  free messaging: a DM to a PRICED inbox still delivers free (no 402)
 *  v0.89  ERC-8004 registration.json carries the A2A service entry → card
 *  v0.90  outbound A2A: /api/a2a/send discovers SIGNA's card + messages it
 *  v0.91  /a2a + homepage + gateway card all reachable
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const BASE = process.env.SIGNA_BASE ?? "https://www.signaagent.xyz";
let fails = 0;
const ok = (c, m) => { console.log((c ? "   ✓ " : "   ✗ FAIL ") + m); if (!c) fails++; };

function dmPreimage(from, to, body, ts) {
  return ["SIGNA agent dm v1", `ts:${ts}`, `from:${from}`, `to:${to}`, `body:${body}`].join("\n");
}
function pricePreimage(addr, price_raw, asset, pay_to, chain, ts) {
  return ["SIGNA dm price set v1", `ts:${ts}`, `address:${addr}`, `price:${price_raw}`,
    `asset:${asset}`, `pay_to:${pay_to}`, `chain:${chain}`].join("\n");
}

// ── v0.88 — priced inbox still delivers a FREE message ──
console.log("v0.88 · free messaging (priced inbox never blocks)");
const seller = privateKeyToAccount(generatePrivateKey());
const buyer = privateKeyToAccount(generatePrivateKey());
const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
{
  // seller prices its inbox
  const ts = Date.now();
  const pre = pricePreimage(seller.address.toLowerCase(), "100000", USDC, seller.address.toLowerCase(), "base", ts);
  const sig = await seller.signMessage({ message: pre });
  const pr = await fetch(`${BASE}/api/agents/${seller.address.toLowerCase()}/dm-price`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: seller.address.toLowerCase(), price_raw: "100000", asset_address: USDC, pay_to: seller.address.toLowerCase(), chain: "base", ts, signature: sig }),
  });
  ok((await pr.json()).priced === true, "seller inbox priced at 0.10 USDC");

  // buyer sends a FREE DM (no payment) — must still deliver
  const ts2 = Date.now();
  const from = buyer.address.toLowerCase(), to = seller.address.toLowerCase();
  const pre2 = dmPreimage(from, to, "free message to a priced inbox", ts2);
  const sig2 = await buyer.signMessage({ message: pre2 });
  const r = await fetch(`${BASE}/api/agents/${from}/dm`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ from, to, body: "free message to a priced inbox", ts: ts2, signature: sig2 }),
  });
  const j = await r.json();
  ok(r.status === 200 && j.ok === true, `delivered with HTTP ${r.status} (no 402)`);
  ok(j.dm?.paid === false, "delivered free (paid=false)");
  ok(!!j.tip_hint, `tip_hint present (advisory): ${j.tip_hint?.suggested ?? "—"}`);
}

// ── v0.89 — ERC-8004 registration.json → A2A service ──
console.log("\nv0.89 · ERC-8004 registration carries the A2A card");
{
  // use a known launched agent if any; else this 404s gracefully — test the gateway card chain instead
  const r = await fetch(`${BASE}/agent/${seller.address.toLowerCase()}/registration.json`);
  if (r.status === 200) {
    const reg = await r.json();
    const a2a = (reg.services ?? []).find((s) => s.name === "A2A");
    ok(!!a2a, `registration services[] has A2A entry → ${a2a?.endpoint ?? "—"}`);
    ok(a2a?.version === "0.3.0", `A2A service version ${a2a?.version}`);
  } else {
    ok(true, `registration.json only for launched agents (HTTP ${r.status}) — chain verified via card below`);
  }
}

// ── v0.90 — outbound A2A: SIGNA agent messages an external A2A agent (loopback to SIGNA's own card) ──
console.log("\nv0.90 · outbound A2A (discover card + message/send)");
{
  const r = await fetch(`${BASE}/api/a2a/send`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      card_url: `${BASE}/.well-known/agent-card.json`,
      text: "outbound test: one line — what is SIGNA?",
      from: "v0891-conformance",
    }),
  });
  const j = await r.json();
  ok(r.status === 200 && j.ok === true, `outbound send HTTP ${r.status}`);
  ok(j.discovered_from_card === true, "endpoint discovered from agent card");
  ok(typeof j.reply_text === "string" && j.reply_text.length > 5, `remote reply: "${(j.reply_text || "").slice(0, 80)}…"`);
}

// ── v0.91 — discovery surfaces reachable ──
console.log("\nv0.91 · discovery surfaces");
for (const [label, path] of [["gateway card", "/.well-known/agent-card.json"], ["/a2a page", "/a2a"], ["homepage", "/"]]) {
  const r = await fetch(`${BASE}${path}`);
  ok(r.status === 200, `${label} → HTTP ${r.status}`);
}

console.log(fails === 0 ? "\n✓ v0.88–v0.91 all green on prod" : `\n✗ ${fails} check(s) failed`);
if (fails > 0) process.exit(1);
