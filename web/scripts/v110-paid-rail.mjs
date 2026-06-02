/**
 * v2.1 — the paid capability rail (agents that transact, live on prod, no mock).
 *
 * A provider registers a PRICED capability. Another agent calls it and pays for
 * it over x402 — agent-to-agent, on Base, keyless:
 *
 *   1. CHALLENGE  — calling the priced cap with no payment returns HTTP 402
 *                   advertising exactly what to pay (amount, asset, payTo)
 *   2. PAY        — the caller signs a real EIP-3009 USDC transferWithAuthorization
 *                   to the provider and attaches it as the X-PAYMENT header
 *   3. VERIFY+RUN — SIGNA cryptographically verifies the authorization pays the
 *                   provider the asked amount, then fulfills; the result is
 *                   gateway-signed and the payment receipt is attached
 *   4. REJECT     — an underpaying authorization is refused (still 402)
 *
 * SIGNA never settles and never holds funds — the authorization is a real,
 * settleable instrument the provider broadcasts out of band. Signing it costs
 * nothing, so this proves the full SIGNA-side rail with no spend. (To actually
 * move the USDC, the provider submits the same authorization to the token
 * contract; EIP-3009 makes verification and settlement separable.)
 *
 *   node scripts/v110-paid-rail.mjs
 */
import { mkdirSync, writeFileSync, readdirSync, existsSync, unlinkSync, renameSync } from "node:fs";
import { resolve as presolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyMessage } from "viem";

const BASE = process.env.SIGNA_BASE ?? "https://www.signaagent.xyz";
const OUT = "C:/Users/Acer/OneDrive/Desktop/signa-private/screenshots";
mkdirSync(OUT, { recursive: true });
const short = (a) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
let fails = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL ") + m); if (!c) fails++; };

const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const provider = privateKeyToAccount(generatePrivateKey());
const payer = privateKeyToAccount(generatePrivateKey());
const suffix = provider.address.slice(2, 8).toLowerCase();
const NAME = `paid.eth-usd-${suffix}`;
const ENDPOINT = "https://coins.llama.fi/prices/current/coingecko:ethereum";
const PRICE = 0.01; // USDC per call

const registerPreimage = ({ ts, name, provider, endpoint, method, price }) =>
  ["SIGNA capability register v1", `ts:${ts}`, `name:${name}`, `provider:${provider.toLowerCase()}`, `endpoint:${endpoint}`, `method:${method.toUpperCase()}`, `price:${price}`].join("\n");
const resultPreimage = (cap, input, prov, ts, output) => {
  const outHash = createHash("sha256").update(JSON.stringify(output)).digest("hex");
  return ["SIGNA capability result v1", `cap:${cap}`, `input:${input}`, `provider:${prov}`, `ts:${ts}`, `output:${outHash}`].join("\n");
};
const randomNonce = () => "0x" + Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");

async function signPayment(value) {
  const nowSec = Math.floor(Date.now() / 1000);
  const authorization = { from: payer.address, to: provider.address.toLowerCase(), value, validAfter: 0n, validBefore: BigInt(nowSec + 300), nonce: randomNonce() };
  const signature = await payer.signTypedData({
    domain: { name: "USD Coin", version: "2", chainId: 8453, verifyingContract: USDC_BASE },
    types: { TransferWithAuthorization: [
      { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
    ] },
    primaryType: "TransferWithAuthorization",
    message: authorization,
  });
  return Buffer.from(JSON.stringify({
    x402Version: 2, scheme: "exact", network: "eip155:8453",
    payload: { signature, authorization: { from: authorization.from, to: authorization.to, value: authorization.value.toString(), validAfter: "0", validBefore: authorization.validBefore.toString(), nonce: authorization.nonce } },
  }), "utf8").toString("base64");
}
const invoke = (xPayment) => fetch(`${BASE}/api/capabilities/invoke`, {
  method: "POST",
  headers: { "content-type": "application/json", ...(xPayment ? { "x-payment": xPayment } : {}) },
  body: JSON.stringify({ cap: NAME, arg: "" }),
});

console.log(`the SIGNA paid capability rail — challenge → pay → verify+run → reject (live on ${BASE})`);
console.log(`  provider ${short(provider.address)} · payer ${short(payer.address)} · ${NAME} @ ${PRICE} USDC/call\n`);

// ─────────────── register the priced capability ───────────────
const ts = Date.now();
const sig = await provider.signMessage({ message: registerPreimage({ ts, name: NAME, provider: provider.address, endpoint: ENDPOINT, method: "GET", price: PRICE }) });
let reg = {};
try {
  reg = await (await fetch(`${BASE}/api/capabilities/register`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: NAME, endpoint: ENDPOINT, method: "GET", description: "ETH price in USD, priced per call (x402 demo)", price_usdc: PRICE, provider: provider.address.toLowerCase(), ts, signature: sig }) })).json();
} catch (e) { console.log("register error", String(e).slice(0, 120)); }
ok(reg?.ok === true, `REGISTER: priced capability published (${reg?.ok ? "live" : reg?.error ?? "failed"})`);

// ─────────────── 1. CHALLENGE — no payment → 402 ───────────────
const r402 = await invoke(null);
const challenge = await r402.json().catch(() => ({}));
const accept = challenge?.accepts?.[0];
const wantRaw = String(Math.round(PRICE * 1e6));
ok(r402.status === 402 && accept?.payTo?.toLowerCase() === provider.address.toLowerCase() && accept?.maxAmountRequired === wantRaw && accept?.asset?.toLowerCase() === USDC_BASE,
  `CHALLENGE: 402 asks ${PRICE} USDC (${wantRaw}) to ${short(provider.address)} in USDC on Base`);

// ─────────────── 2+3. PAY — valid authorization → verified + fulfilled ───────────────
const okPay = await signPayment(BigInt(wantRaw));
const rPaid = await invoke(okPay);
const paid = await rPaid.json().catch(() => ({}));
const price = (() => { try { return paid?.output?.coins?.["coingecko:ethereum"]?.price ?? null; } catch { return null; } })();
ok(rPaid.status === 200 && paid?.ok === true && price != null, `PAY: authorization accepted, capability fulfilled — ETH ≈ $${price ?? "?"}`);
ok(paid?.payment?.payer?.toLowerCase() === payer.address.toLowerCase() && paid?.payment?.amount_raw === wantRaw,
  `RECEIPT: payment receipt records payer ${short(payer.address)} paid ${wantRaw} to the provider (SIGNA never settles)`);
let sigOk = false;
try {
  sigOk = paid?.signature && paid?.gateway
    ? await verifyMessage({ address: paid.gateway, message: resultPreimage(NAME, "", provider.address.toLowerCase(), paid.ts, paid.output), signature: paid.signature })
    : false;
} catch { sigOk = false; }
ok(sigOk, `VERIFY: paid result re-verifies against the gateway ${short(paid?.gateway ?? "")} (EIP-191)`);

// ─────────────── 4. REJECT — underpayment refused ───────────────
const underPay = await signPayment(BigInt(Math.round(PRICE * 1e6) - 5000)); // half price
const rUnder = await invoke(underPay);
const under = await rUnder.json().catch(() => ({}));
ok(rUnder.status === 402 && /underpaid|payment_invalid/i.test(under?.error ?? ""), `REJECT: an underpaying authorization is refused (${under?.error ?? rUnder.status})`);

console.log(fails === 0
  ? "\n✓ paid rail verified live — priced call, x402 challenge, signed USDC authorization verified, fulfilled, underpay rejected"
  : `\n✗ ${fails} step(s) failed`);

// ─────────────── animated proof + video ───────────────
const allGreen = fails === 0;
const steps = [
  { k: "challenge", c: "#9ad7ff", t: `calling the priced cap with no payment → HTTP 402: pay ${PRICE} USDC to ${short(provider.address)} on base` },
  { k: "pay", c: "#b7ff5c", t: `the caller signs an EIP-3009 USDC authorization to the provider and attaches X-PAYMENT` },
  { k: "verify + run", c: "#7af0a8", t: `SIGNA verifies the authorization pays the provider, fulfills the call → ETH ≈ $${price ?? "?"} · gateway-signed` },
  { k: "reject", c: "#ff7a7a", t: `an underpaying authorization is refused — payment is enforced, SIGNA never settles or holds funds` },
];
const data = JSON.stringify({ steps, allGreen, name: NAME });
const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
 :root{--bg:#06070b;--accent:#b7ff5c;--text:#e9ecf2;--muted:rgba(233,236,242,0.45)}
 *{box-sizing:border-box;margin:0;padding:0}
 html,body{background:var(--bg);color:var(--text);font-family:"JetBrains Mono",ui-monospace,monospace}
 .stage{width:1280px;height:720px;display:flex;flex-direction:column;padding:34px 50px;background:radial-gradient(ellipse 60% 45% at 50% 0%,rgba(183,255,92,0.09),transparent 70%),var(--bg)}
 .head{display:flex;align-items:baseline;justify-content:space-between}
 .brand{font-family:"Space Grotesk",sans-serif;font-size:25px;font-weight:600}.brand .a{color:var(--accent)}
 .tag{font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:var(--accent)}
 .sub{font-size:13.5px;color:var(--muted);margin:8px 0 22px;max-width:1010px;line-height:1.45}
 .flow{flex:1;display:flex;flex-direction:column;gap:14px;justify-content:center}
 .step{display:flex;align-items:flex-start;gap:18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px 20px;opacity:0;transform:translateX(-14px);transition:opacity .5s,transform .5s}
 .step.show{opacity:1;transform:translateX(0)}
 .k{font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;min-width:120px}
 .t{flex:1;font-size:14.5px;color:rgba(245,245,250,0.9);line-height:1.4}
 .seal{margin-top:18px;display:flex;align-items:center;justify-content:space-between;opacity:0;transition:opacity .7s}.seal.show{opacity:1}
 .l{font-size:15px;color:var(--accent);font-weight:600} .r{font-size:13px;color:var(--muted)}.r b{color:var(--accent)}
</style></head><body>
<div class="stage">
 <div class="head"><div class="brand"><span class="a">signa</span> paid rail · agents that transact on base</div><div class="tag">x402 · keyless · base</div></div>
 <div class="sub">a provider prices a capability. another agent pays for it over x402 in usdc on base — keyless, agent to agent. signa verifies the payment authorization and gates the call; the provider settles it out of band. signa never holds funds. live on prod.</div>
 <div class="flow" id="flow"></div>
 <div class="seal" id="seal"><div class="l">✓ challenge · pay · verify + run · reject — real x402, signed result, underpay refused</div><div class="r">signaagent.xyz/<b>marketplace</b></div></div>
</div>
<script>
const D = ${data};
const pause = (ms) => new Promise(r => setTimeout(r, ms));
const flow = document.getElementById('flow');
for (let i=0;i<D.steps.length;i++){ const s=D.steps[i]; const d=document.createElement('div'); d.className='step'; d.id='s'+i;
  d.innerHTML='<div class="k" style="color:'+s.c+'">'+s.k+'</div><div class="t">'+String(s.t).replace(/</g,'&lt;')+'</div>'; flow.appendChild(d); }
(async () => {
  await pause(600);
  for (let i=0;i<D.steps.length;i++){ document.getElementById('s'+i).classList.add('show'); await pause(1050); }
  await pause(500); if (D.allGreen) document.getElementById('seal').classList.add('show');
  await pause(2600); document.body.setAttribute('data-done','true');
})();
</script>
</body></html>`;
const htmlPath = presolve("./scripts/v110-paid-rail.html");
writeFileSync(htmlPath, html);
const tgt = `${OUT}/signa-v110-paid-rail.webm`;
if (existsSync(tgt)) unlinkSync(tgt);
const before = new Set(readdirSync(OUT).filter((f) => f.endsWith(".webm")));
try {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } }, colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(htmlPath).href);
  await page.waitForFunction(() => document.body.getAttribute("data-done") === "true", { timeout: 120000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/signa-v110-paid-rail-still.png` });
  await page.close(); await ctx.close(); await browser.close();
  const fresh = readdirSync(OUT).filter((f) => f.endsWith(".webm") && !before.has(f));
  if (fresh.length === 1) { renameSync(`${OUT}/${fresh[0]}`, tgt); console.log("saved", tgt); }
  console.log("still:", `${OUT}/signa-v110-paid-rail-still.png`);
} catch (e) { console.log("playwright unavailable:", e.message); }
process.exit(fails > 0 ? 1 : 0);
