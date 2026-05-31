/**
 * v1.2 — Bankr on the bus (live, no mock).
 *
 * Bankr is the identity on-ramp to the SIGNA wire. Proves, end to end on
 * prod, with only wallets and no API keys:
 *   1. Bankr resolves a social handle (@mac_eth) to a real wallet
 *   2. SIGNA's universal resolver speaks Bankr — @handle becomes a
 *      messageable identity on the bus (signa + a2a routes)
 *   3. a keyless cross-framework agent DMs a live Bankr agent on the wire
 *      and gets real Bankr data back, wallet-signed: a resolved handle and
 *      the latest Base launch
 *
 *   node scripts/v102-bankr-bus.mjs
 */
import { mkdirSync, writeFileSync, readdirSync, existsSync, unlinkSync, renameSync } from "node:fs";
import { resolve as presolve } from "node:path";
import { pathToFileURL } from "node:url";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes } from "viem";

const BASE = process.env.SIGNA_BASE ?? "https://www.signaagent.xyz";
const BANKR = "https://api.bankr.bot";
const OUT = "C:/Users/Acer/OneDrive/Desktop/signa-private/screenshots";
mkdirSync(OUT, { recursive: true });
const short = (a) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
let fails = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL ") + m); if (!c) fails++; };

function dmPreimage(from, to, body, ts) {
  return ["SIGNA agent dm v1", `ts:${ts}`, `from:${from.toLowerCase()}`, `to:${to.toLowerCase()}`, `body:${body}`].join("\n");
}
async function sendDm(account, to, body) {
  const from = account.address.toLowerCase(); const ts = Date.now();
  const signature = await account.signMessage({ message: dmPreimage(from, to, body, ts) });
  const r = await fetch(`${BASE}/api/agents/${from}/dm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ from, to: to.toLowerCase(), body, ts, signature }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(`send ${r.status}`);
  return j.dm;
}
async function inbox(addr, limit = 5) { const r = await fetch(`${BASE}/api/agents/${addr.toLowerCase()}/inbox?limit=${limit}`); return (await r.json().catch(() => ({}))).dms ?? []; }
async function announce(account, platform, model, label) {
  const ts = Date.now(); const caps = ["identity", "resolve", "launches", "message"];
  const lines = ["SIGNA agent bridge register v1", `ts:${ts}`, `address:${account.address.toLowerCase()}`, `platform:${platform.toLowerCase()}`, `model:${model}`, `label:${label}`, `capabilities:${caps.join(",")}`,
    "I am operating an agent bridge between SIGNA's DM substrate and", `the ${platform} platform. My wallet receives DMs on SIGNA`, "and forwards them to the model above, then signs the reply and", "posts it back. I can deregister at any time."];
  const signature = await account.signMessage({ message: lines.join("\n") });
  const r = await fetch(`${BASE}/api/bridges/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: account.address.toLowerCase(), platform, platform_model: model, label, capabilities: caps, ts, signature }) });
  const j = await r.json().catch(() => ({})); if (!r.ok || !j.ok) throw new Error(`announce ${r.status}`); return j.bridge;
}
async function bankrAgent(q) { const r = await fetch(`${BASE}/api/partners/bankr/agent?q=${encodeURIComponent(q)}`); return (await r.json().catch(() => ({}))); }

// ── 1. Bankr resolves a social handle to a real wallet (direct, real) ──
console.log("1 · Bankr resolves a social identity to a wallet (direct, keyless)");
let macWallet = null;
try { const j = await (await fetch(`${BANKR}/addresses/resolve?value=mac_eth&type=twitter`)).json(); macWallet = j?.address ?? null; ok(/^0x[a-f0-9]{40}$/i.test(macWallet ?? ""), `Bankr: @mac_eth → ${macWallet} (${j?.displayName ?? ""})`); }
catch (e) { ok(false, "bankr resolve " + String(e).slice(0, 60)); }

// ── 2. SIGNA universal resolver speaks Bankr — @handle is now on the bus ──
console.log("\n2 · SIGNA resolver speaks Bankr — @handle becomes messageable on the bus");
let r2 = null;
try { r2 = await (await fetch(`${BASE}/api/resolve?id=@mac_eth`)).json(); } catch {}
ok(r2?.ok && r2?.source?.startsWith("bankr") && r2?.address === (macWallet ?? "").toLowerCase(), `/api/resolve?id=@mac_eth → ${short(r2?.address)} via ${r2?.source}`);
ok((r2?.reachable_via ?? []).includes("signa") && (r2?.reachable_via ?? []).includes("a2a"), `reachable via [${(r2?.reachable_via ?? []).join(", ")}] — any agent can now DM @mac_eth on the wire`);

// ── 3. a live Bankr agent on the wire ──
console.log("\n3 · a Bankr agent on the wire (deterministic wallet, announced)");
const bankrA = privateKeyToAccount(keccak256(toBytes("signa:bankr-agent:v1")));
try { await announce(bankrA, "bankr", "Bankr", "Bankr identity + execution agent"); ok(true, `Bankr agent ${short(bankrA.address)} announced as platform=bankr`); } catch (e) { ok(false, "announce " + String(e).slice(0, 60)); }
let r3 = null; try { r3 = await (await fetch(`${BASE}/api/resolve?id=${bankrA.address}`)).json(); } catch {}
ok(r3?.routes?.bridge?.platform === "bankr", `resolver tags it: platform=${r3?.routes?.bridge?.platform ?? "(lag)"}`);

// ── 4. cross-framework round trip with real Bankr data ──
console.log("\n4 · a keyless Hermes agent asks the Bankr agent (real Bankr data, wallet-signed)");
const hermes = privateKeyToAccount(generatePrivateKey());
const q1 = "resolve @mac_eth to a wallet i can message";
const q2 = "what's the latest base launch?";
let ans1 = "", ans2 = "";
try {
  await sendDm(hermes, bankrA.address, q1);
  const got1 = (await inbox(bankrA.address, 8)).find((d) => d.from_address === hermes.address.toLowerCase() && d.body === q1);
  ok(!!got1, `Hermes → Bankr: "${q1}"`);
  ans1 = (await bankrAgent(q1)).answer ?? "";
  await sendDm(bankrA, hermes.address, ans1);
  ok(/0x[a-f0-9]{40}/i.test(ans1), `Bankr → Hermes (signed): "${ans1.slice(0, 80)}…"`);

  await sendDm(hermes, bankrA.address, q2);
  ans2 = (await bankrAgent(q2)).answer ?? "";
  await sendDm(bankrA, hermes.address, ans2);
  ok(/launch/i.test(ans2) && ans2.length > 20, `Bankr → Hermes (signed): "${ans2.slice(0, 80)}…"`);

  const replies = (await inbox(hermes.address, 8)).filter((d) => d.from_address === bankrA.address.toLowerCase());
  ok(replies.length >= 2, `Hermes received ${replies.length} wallet-signed replies — round trip complete`);
} catch (e) { ok(false, "round trip " + String(e).slice(0, 80)); }

console.log(fails === 0
  ? "\n✓ Bankr on the bus verified live — resolve any handle, message anyone, by wallet, keyless"
  : `\n✗ ${fails} step(s) failed`);

// ─────────────── two-pane animated proof + video ───────────────
const allGreen = fails === 0;
const convo = [
  { side: "h", kind: "sys", t: `keyless Hermes agent ${short(hermes.address)}` },
  { side: "b", kind: "sys", t: `Bankr agent ${short(bankrA.address)} · platform=bankr` },
  { side: "h", kind: "msg", t: q1 },
  { side: "b", kind: "act", t: `resolving via api.bankr.bot` },
  { side: "b", kind: "msg", t: ans1 || "resolved via Bankr" },
  { side: "h", kind: "msg", t: q2 },
  { side: "b", kind: "msg", t: ans2 || "latest Base launch via Bankr" },
];
const data = JSON.stringify({ H: short(hermes.address), B: short(bankrA.address), convo, allGreen });

const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
 :root{--bg:#06070b;--accent:#b7ff5c;--green:#66f0a2;--cyan:#9ad7ff;--text:#e9ecf2;--muted:rgba(233,236,242,0.45)}
 *{box-sizing:border-box;margin:0;padding:0}
 html,body{background:var(--bg);color:var(--text);font-family:"JetBrains Mono",ui-monospace,monospace}
 .stage{width:1280px;height:720px;display:flex;flex-direction:column;padding:30px 40px;background:radial-gradient(ellipse 60% 45% at 50% 0%,rgba(102,240,162,0.08),transparent 70%),var(--bg)}
 .head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px}
 .brand{font-family:"Space Grotesk",sans-serif;font-size:24px;font-weight:600;letter-spacing:-0.02em}
 .brand .a{color:var(--accent)} .brand .g{color:var(--green)}
 .tag{font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:var(--green)}
 .subtitle{font-size:13px;color:var(--muted);margin-bottom:12px}
 .wire{display:flex;align-items:center;justify-content:center;gap:10px;margin:6px 0 12px;font-size:11.5px;color:var(--muted);letter-spacing:0.04em}
 .cols{flex:1;display:flex;gap:18px}
 .pane{flex:1;display:flex;flex-direction:column;background:linear-gradient(180deg,#0b0d13,#080a0f);border:1px solid rgba(255,255,255,0.09);border-radius:14px;overflow:hidden}
 .pbar{height:42px;display:flex;align-items:center;gap:10px;padding:0 16px;border-bottom:1px solid rgba(255,255,255,0.07)}
 .logo{width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#06070b}
 .h .logo{background:var(--cyan)} .b .logo{background:var(--green)}
 .pname{font-size:13px;font-weight:600} .h .pname{color:var(--cyan)} .b .pname{color:var(--green)}
 .paddr{font-size:11px;color:var(--muted);margin-left:auto}
 .feed{flex:1;padding:14px;display:flex;flex-direction:column;gap:10px;overflow:hidden}
 .bub{max-width:92%;padding:9px 13px;border-radius:11px;font-size:12.5px;line-height:1.45;opacity:0;transform:translateY(8px);transition:opacity .45s,transform .45s}
 .bub.show{opacity:1;transform:translateY(0)}
 .sys{align-self:center;background:rgba(255,255,255,0.04);color:var(--muted);font-size:11.5px;text-align:center}
 .act{align-self:flex-start;background:rgba(102,240,162,0.07);border:1px solid rgba(102,240,162,0.18);color:var(--green);font-size:12px}
 .msg{align-self:flex-end;background:rgba(154,215,255,0.10);border:1px solid rgba(154,215,255,0.28);color:var(--text)}
 .msgin{align-self:flex-start;background:rgba(102,240,162,0.10);border:1px solid rgba(102,240,162,0.28);color:var(--text)}
 .seal{margin-top:12px;display:flex;align-items:center;justify-content:space-between;opacity:0;transition:opacity .7s}
 .seal.show{opacity:1}
 .seal .l{font-size:15px;color:var(--green);font-weight:600}
 .seal .r2{font-size:13px;color:var(--muted)} .seal .r2 b{color:var(--green)}
</style></head><body>
<div class="stage">
 <div class="head"><div class="brand"><span class="a">signa</span> bus <span style="color:var(--muted)">×</span> <span class="g">bankr</span></div><div class="tag">keyless · wallet-signed · base</div></div>
 <div class="subtitle">Bankr resolves any handle to a wallet. SIGNA makes every wallet messageable. address @anybody, DM them on the wire.</div>
 <div class="wire">Hermes agent <span style="color:var(--green)">⇄ signa ⇄</span> Bankr agent — neither holds an api key</div>
 <div class="cols">
  <div class="pane h"><div class="pbar"><div class="logo">H</div><div class="pname">Hermes agent</div><div class="paddr" id="ha"></div></div><div class="feed" id="hf"></div></div>
  <div class="pane b"><div class="pbar"><div class="logo">B</div><div class="pname">Bankr agent</div><div class="paddr" id="ba"></div></div><div class="feed" id="bf"></div></div>
 </div>
 <div class="seal" id="seal"><div class="l">✓ Bankr on the bus — resolve any handle, message anyone, by wallet</div><div class="r2"><b>signaagent.xyz/partners/bankr</b></div></div>
</div>
<script>
const D = ${data};
const pause = (ms) => new Promise(r => setTimeout(r, ms));
document.getElementById('ha').textContent = D.H; document.getElementById('ba').textContent = D.B;
function bubble(feedId, cls, text) { const f = document.getElementById(feedId); const d = document.createElement('div'); d.className = 'bub ' + cls; d.textContent = text; f.appendChild(d); requestAnimationFrame(() => d.classList.add('show')); }
(async () => {
  await pause(700);
  for (const c of D.convo) {
    const feed = c.side === 'h' ? 'hf' : 'bf';
    if (c.kind === 'sys') bubble(feed, 'sys', c.t);
    else if (c.kind === 'act') bubble(feed, 'act', c.t);
    else if (c.kind === 'msg') { bubble(feed, 'msg', c.t); await pause(650); bubble(c.side === 'h' ? 'bf' : 'hf', 'msgin', c.t); }
    await pause(1050);
  }
  await pause(500); if (D.allGreen) document.getElementById('seal').classList.add('show');
  await pause(2600); document.body.setAttribute('data-done','true');
})();
</script>
</body></html>`;

const htmlPath = presolve("./scripts/v102-bankr-bus.html");
writeFileSync(htmlPath, html);
const target = `${OUT}/signa-v102-bankr-bus.webm`;
if (existsSync(target)) unlinkSync(target);
const before = new Set(readdirSync(OUT).filter((f) => f.endsWith(".webm")));
try {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } }, colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(htmlPath).href);
  await page.waitForFunction(() => document.body.getAttribute("data-done") === "true", { timeout: 120000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/signa-v102-bankr-bus-still.png` });
  await page.close(); await ctx.close(); await browser.close();
  const fresh = readdirSync(OUT).filter((f) => f.endsWith(".webm") && !before.has(f));
  if (fresh.length === 1) { renameSync(`${OUT}/${fresh[0]}`, target); console.log("saved", target); }
  console.log("still:", `${OUT}/signa-v102-bankr-bus-still.png`);
} catch (e) { console.log("playwright unavailable:", e.message, "· html at", htmlPath); }
process.exit(fails > 0 ? 1 : 0);
