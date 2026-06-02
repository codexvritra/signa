/**
 * v1.8 — the open capability marketplace (live, no mock).
 *
 * A developer (a fresh wallet) registers a REAL https endpoint as a network
 * capability with ONE wallet-signed call. We then prove the full loop on prod:
 *
 *   1. REGISTER   — one EIP-191 signature publishes the capability (no api key)
 *   2. DIRECTORY  — it appears in the open directory, callable by anyone
 *   3. INVOKE     — any agent calls it; the result is gateway-signed; we
 *                   re-verify that signature with viem (real ETH price data)
 *   4. BRAIN      — the autonomous brain DISCOVERS the new capability, plans
 *                   around it, calls it for real, and answers from live data,
 *                   signing a verifiable receipt
 *
 * The capability points at DefiLlama's public, key-free price API, so the
 * data is real and nothing is mocked.
 *
 *   node scripts/v108-marketplace.mjs
 */
import { mkdirSync, writeFileSync, readdirSync, existsSync, unlinkSync, renameSync } from "node:fs";
import { resolve as presolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyMessage, keccak256, toBytes } from "viem";

const BASE = process.env.SIGNA_BASE ?? "https://www.signaagent.xyz";
const OUT = "C:/Users/Acer/OneDrive/Desktop/signa-private/screenshots";
mkdirSync(OUT, { recursive: true });
const short = (a) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
let fails = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL ") + m); if (!c) fails++; };
const jget = async (u) => (await fetch(u, { headers: { accept: "application/json" } })).json().catch(() => ({}));

// a fresh "developer" wallet — proves no account/api key is needed, just a sig
const dev = privateKeyToAccount(generatePrivateKey());
const provider = dev.address.toLowerCase();
// mirror the server's deterministic identities (for display fallback only)
const gatewayAddr = privateKeyToAccount(keccak256(toBytes("signa:capability-gateway:v1"))).address.toLowerCase();
const brainAddr = privateKeyToAccount(keccak256(toBytes("signa:brain:v1"))).address.toLowerCase();

// unique-ish name per run without Date.now() collisions across runs
const suffix = provider.slice(2, 8);
const NAME = `community.ethusd-${suffix}`;
const ENDPOINT = "https://coins.llama.fi/prices/current/coingecko:ethereum";
const METHOD = "GET";
const DESC = "current ETH price in USD (live, from DefiLlama public price API)";

function registerPreimage({ ts, name, provider, endpoint, method, price }) {
  return [
    "SIGNA capability register v1",
    `ts:${ts}`,
    `name:${name}`,
    `provider:${provider.toLowerCase()}`,
    `endpoint:${endpoint}`,
    `method:${method.toUpperCase()}`,
    `price:${price}`,
  ].join("\n");
}
function resultPreimage(cap, input, prov, ts, output) {
  const outHash = createHash("sha256").update(JSON.stringify(output)).digest("hex");
  return ["SIGNA capability result v1", `cap:${cap}`, `input:${input}`, `provider:${prov}`, `ts:${ts}`, `output:${outHash}`].join("\n");
}
// keccak of the seed string → deterministic key (mirror of the server's identities)
function createHashKey(seed) {
  // viem keccak256(toBytes(seed)) — but keep deps minimal: import lazily
  // (we only need this for display; recompute exactly like the server)
  return _kk(seed);
}
import { keccak256, toBytes } from "viem";
function _kk(seed) { return keccak256(toBytes(seed)); }

console.log(`the SIGNA marketplace — register → directory → invoke → brain (live on ${BASE})`);
console.log(`  developer wallet (fresh, no account): ${short(provider)}`);
console.log(`  publishing: ${NAME}  →  ${ENDPOINT}\n`);

// ─────────────── 1. REGISTER (one signature) ───────────────
const ts = Date.now();
const signature = await dev.signMessage({ message: registerPreimage({ ts, name: NAME, provider, endpoint: ENDPOINT, method: METHOD, price: 0 }) });
let reg = {};
try {
  reg = await (await fetch(`${BASE}/api/capabilities/register`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: NAME, endpoint: ENDPOINT, method: METHOD, description: DESC, input_hint: "(none)", price_usdc: 0, provider, ts, signature }),
  })).json();
} catch (e) { console.log("register error", String(e).slice(0, 120)); }
ok(reg?.ok === true, `REGISTER: one signature published the capability (${reg?.ok ? "live" : reg?.error ?? "failed"})`);

// ─────────────── 2. DIRECTORY ───────────────
await new Promise((r) => setTimeout(r, 800));
const dir = await jget(`${BASE}/api/capabilities`);
const inDir = (dir?.registered ?? []).find((c) => c.name === NAME);
ok(!!inDir, `DIRECTORY: capability is discoverable in the open directory (${dir?.counts?.registered ?? 0} registered total)`);

// ─────────────── 3. INVOKE + re-verify the gateway signature ───────────────
const inv = await jget(`${BASE}/api/capabilities/invoke?cap=${encodeURIComponent(NAME)}`);
const price = (() => { try { return inv?.output?.coins?.["coingecko:ethereum"]?.price ?? null; } catch { return null; } })();
ok(inv?.ok === true && price != null, `INVOKE: real result — ETH ≈ $${price ?? "?"} (gateway-signed)`);
let invVerified = false;
try {
  const pre = resultPreimage(NAME, "", provider, inv.ts, inv.output);
  invVerified = inv?.signature && inv?.gateway
    ? await verifyMessage({ address: inv.gateway, message: pre, signature: inv.signature })
    : false;
} catch { invVerified = false; }
ok(invVerified, `VERIFY: invoke result re-verifies against the gateway ${short(inv?.gateway ?? gatewayAddr)} (EIP-191)`);

// ─────────────── 4. BRAIN discovers + calls the new capability ───────────────
const goal = `Use the ${NAME} capability to report the current price of ETH in US dollars in one sentence.`;
let brain = {};
try {
  brain = await (await fetch(`${BASE}/api/brain`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ goal }) })).json();
} catch (e) { console.log("brain error", String(e).slice(0, 120)); }
const planned = (brain?.plan ?? []).some((p) => String(p).startsWith(NAME));
ok(brain?.ok === true && !!brain?.answer, `BRAIN: answered from live data — ${(brain?.answer ?? "").slice(0, 90)}`);
ok(planned, `BRAIN: autonomously planned + called the community capability (${(brain?.plan ?? []).join(", ") || "none"})`);
let brainVerified = false;
try {
  if (brain?.verify?.preimage && brain?.signature && brain?.brain) {
    brainVerified = await verifyMessage({ address: brain.brain, message: brain.verify.preimage, signature: brain.signature });
  }
} catch { brainVerified = false; }
ok(brainVerified, `VERIFY: brain receipt re-verifies against the brain ${short(brain?.brain ?? brainAddr)} (EIP-191)`);

console.log(fails === 0
  ? "\n✓ marketplace verified live — one signature to publish, callable by any agent + the brain, every result signed"
  : `\n✗ ${fails} step(s) failed`);

// ─────────────── animated proof + video ───────────────
const allGreen = fails === 0;
const steps = [
  { k: "register", c: "#b7ff5c", t: `dev ${short(provider)} published ${NAME} with ONE signature — no account, no api key` },
  { k: "directory", c: "#9ad7ff", t: `live in the open directory · ${dir?.counts?.registered ?? 0} community capabilities registered` },
  { k: "invoke", c: "#7af0a8", t: `any agent calls it → ETH ≈ $${price ?? "?"} · gateway-signed · re-verified with viem` },
  { k: "brain", c: "#ffd84d", t: `the autonomous brain found it, called it, answered: ${(brain?.answer ?? "").slice(0, 80)}` },
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
 .k{font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;min-width:104px}
 .t{flex:1;font-size:14.5px;color:rgba(245,245,250,0.9);line-height:1.4}
 .seal{margin-top:18px;display:flex;align-items:center;justify-content:space-between;opacity:0;transition:opacity .7s}.seal.show{opacity:1}
 .l{font-size:15px;color:var(--accent);font-weight:600} .r{font-size:13px;color:var(--muted)}.r b{color:var(--accent)}
</style></head><body>
<div class="stage">
 <div class="head"><div class="brand"><span class="a">signa</span> marketplace · publish in one signature</div><div class="tag">keyless · wallet-signed · base</div></div>
 <div class="sub">a developer registers any https endpoint as a capability with a single wallet-signed call. it is callable by every agent and by the autonomous brain the moment it lands — and every result comes back signed. live on prod, real data, no mock.</div>
 <div class="flow" id="flow"></div>
 <div class="seal" id="seal"><div class="l">✓ one signature → discoverable → invoked → used by the brain — every result re-verified</div><div class="r">signaagent.xyz/<b>marketplace</b></div></div>
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
  await pause(2800); document.body.setAttribute('data-done','true');
})();
</script>
</body></html>`;
const htmlPath = presolve("./scripts/v108-marketplace.html");
writeFileSync(htmlPath, html);
const tgt = `${OUT}/signa-v108-marketplace.webm`;
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
  await page.screenshot({ path: `${OUT}/signa-v108-marketplace-still.png` });
  await page.close(); await ctx.close(); await browser.close();
  const fresh = readdirSync(OUT).filter((f) => f.endsWith(".webm") && !before.has(f));
  if (fresh.length === 1) { renameSync(`${OUT}/${fresh[0]}`, tgt); console.log("saved", tgt); }
  console.log("still:", `${OUT}/signa-v108-marketplace-still.png`);
} catch (e) { console.log("playwright unavailable:", e.message); }
process.exit(fails > 0 ? 1 : 0);
