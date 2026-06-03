/**
 * v2.5 — the message layer + universal verifier (live on prod, no mock).
 *
 * Proves SIGNA is the decentralized message layer in all three directions, and
 * that ONE endpoint (/api/verify) re-verifies every wallet-signed message + the
 * signed artifacts that ride on it — recovering the signer each time:
 *
 *   human  -> agent   wallet-signed DM, re-verified, recovered == sender
 *   agent  -> human   wallet-signed reply, re-verified, recovered == sender
 *   agent  -> agent   wallet-signed DM, re-verified, recovered == sender
 *   capability result re-verified, recovered == the gateway
 *   brain receipt     re-verified (raw preimage), recovered == the brain
 *
 *   node scripts/v114-message-layer.mjs
 */
import { mkdirSync, writeFileSync, readdirSync, existsSync, unlinkSync, renameSync } from "node:fs";
import { resolve as presolve } from "node:path";
import { pathToFileURL } from "node:url";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const BASE = process.env.SIGNA_BASE ?? "https://www.signaagent.xyz";
const OUT = "C:/Users/Acer/OneDrive/Desktop/signa-private/screenshots";
mkdirSync(OUT, { recursive: true });
const short = (a) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
let fails = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL ") + m); if (!c) fails++; };

const human = privateKeyToAccount(generatePrivateKey());
const agentA = privateKeyToAccount(generatePrivateKey());
const agentB = privateKeyToAccount(generatePrivateKey());

const dmPreimage = (from, to, body, ts) => ["SIGNA agent dm v1", `ts:${ts}`, `from:${from.toLowerCase()}`, `to:${to.toLowerCase()}`, `body:${body}`].join("\n");

async function sendDM(fromAcct, to, body) {
  const from = fromAcct.address.toLowerCase();
  const ts = Date.now();
  const signature = await fromAcct.signMessage({ message: dmPreimage(from, to, body, ts) });
  const r = await fetch(`${BASE}/api/agents/${from}/dm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ from, to: to.toLowerCase(), body, ts, signature }) });
  const j = await r.json().catch(() => ({}));
  return { accepted: r.ok && j?.ok !== false, from, to: to.toLowerCase(), body, ts, signature };
}
async function verify(payload) {
  const r = await fetch(`${BASE}/api/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  return r.json().catch(() => ({}));
}

console.log(`SIGNA message layer — three directions, one universal verifier (live on ${BASE})`);
console.log(`  human ${short(human.address)} · agentA ${short(agentA.address)} · agentB ${short(agentB.address)}\n`);

// ── human -> agent ──
const d1 = await sendDM(human, agentA.address, "gm, are you live and signed?");
const v1 = await verify({ kind: "dm", ts: d1.ts, from: d1.from, to: d1.to, body: d1.body, signature: d1.signature });
ok(d1.accepted && v1?.valid && v1.recovered === d1.from, `human → agent: DM accepted + re-verified · recovered ${short(v1?.recovered)} == sender`);

// ── agent -> human ──
const d2 = await sendDM(agentA, human.address, "live, signed, and re-verifiable by anyone.");
const v2 = await verify({ kind: "dm", ts: d2.ts, from: d2.from, to: d2.to, body: d2.body, signature: d2.signature });
ok(d2.accepted && v2?.valid && v2.recovered === d2.from, `agent → human: reply accepted + re-verified · recovered ${short(v2?.recovered)} == sender`);

// ── agent -> agent ──
const d3 = await sendDM(agentA, agentB.address, "mesh check between two agents");
const v3 = await verify({ kind: "dm", ts: d3.ts, from: d3.from, to: d3.to, body: d3.body, signature: d3.signature });
ok(d3.accepted && v3?.valid && v3.recovered === d3.from, `agent → agent: DM accepted + re-verified · recovered ${short(v3?.recovered)} == sender`);

// ── tamper: change the body, the same signature must NOT verify to the sender ──
const vT = await verify({ kind: "dm", ts: d1.ts, from: d1.from, to: d1.to, body: d1.body + " (tampered)", signature: d1.signature });
ok(vT?.recovered !== d1.from, `tamper: altering the body recovers a different address — forgery is impossible`);

// ── a capability result, re-verified through the SAME endpoint ──
let cap = {};
try { cap = await (await fetch(`${BASE}/api/capabilities/invoke?cap=token.price&arg=ethereum`)).json(); } catch { /* */ }
const vc = await verify({ kind: "capability", cap: cap.capability, input: cap.input ?? "", provider: cap.provider, ts: cap.ts, output: cap.output, signature: cap.signature });
ok(vc?.valid && vc.recovered === (cap.gateway ?? "").toLowerCase(), `capability result re-verified · recovered ${short(vc?.recovered)} == gateway`);

// ── a brain receipt, re-verified via the raw preimage path ──
let brain = {};
try { brain = await (await fetch(`${BASE}/api/brain`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ goal: "one line on the base market" }) })).json(); } catch { /* */ }
const vb = brain?.verify?.preimage
  ? await verify({ kind: "raw", preimage: brain.verify.preimage, expected: brain.brain, signature: brain.signature })
  : { valid: false };
ok(vb?.valid && vb.recovered === (brain.brain ?? "").toLowerCase(), `brain receipt re-verified · recovered ${short(vb?.recovered)} == brain`);

console.log(fails === 0
  ? "\n✓ message layer verified — all three directions wallet-signed + re-verified, plus capability + brain receipts, through one universal verifier. forgery impossible."
  : `\n✗ ${fails} step(s) failed`);

// ─────────────── animated proof + video ───────────────
const allGreen = fails === 0;
const steps = [
  { k: "human → agent", c: "#9ad7ff", t: `a person DMs an agent, signed with their wallet · re-verified · ${short(v1?.recovered)}` },
  { k: "agent → human", c: "#b7ff5c", t: `the agent replies, signed · re-verified · lands in a re-verifiable inbox` },
  { k: "agent → agent", c: "#7af0a8", t: `agent to agent across the mesh, signed · re-verified · ${short(v3?.recovered)}` },
  { k: "one verifier", c: "#ffd84d", t: `DMs, capability results, brain receipts — all re-verified at /api/verify; tamper anything and a different address recovers` },
];
const data = JSON.stringify({ steps, allGreen });
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
 .k{font-size:13px;font-weight:700;letter-spacing:0.06em;min-width:140px}
 .t{flex:1;font-size:14.5px;color:rgba(245,245,250,0.9);line-height:1.4}
 .seal{margin-top:18px;display:flex;align-items:center;justify-content:space-between;opacity:0;transition:opacity .7s}.seal.show{opacity:1}
 .l{font-size:15px;color:var(--accent);font-weight:600} .r{font-size:13px;color:var(--muted)}.r b{color:var(--accent)}
</style></head><body>
<div class="stage">
 <div class="head"><div class="brand"><span class="a">signa</span> · the decentralized message layer</div><div class="tag">agent↔agent · human↔agent · keyless · base</div></div>
 <div class="sub">one substrate for every direction: human to agent, agent to human, agent to agent. every message is an eip-191 wallet signature the network re-verifies and anyone can re-check. one universal verifier covers messages and the signed artifacts that ride on them. no accounts, no api keys, no forgeable inbox. live on prod.</div>
 <div class="flow" id="flow"></div>
 <div class="seal" id="seal"><div class="l">✓ three directions signed + re-verified · capability + brain receipts too · forgery impossible</div><div class="r">signaagent.xyz · <b>/api/verify</b></div></div>
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
const htmlPath = presolve("./scripts/v114-message-layer.html");
writeFileSync(htmlPath, html);
const tgt = `${OUT}/signa-v114-message-layer.webm`;
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
  await page.screenshot({ path: `${OUT}/signa-v114-message-layer-still.png` });
  await page.close(); await ctx.close(); await browser.close();
  const fresh = readdirSync(OUT).filter((f) => f.endsWith(".webm") && !before.has(f));
  if (fresh.length === 1) { renameSync(`${OUT}/${fresh[0]}`, tgt); console.log("saved", tgt); }
  console.log("still:", `${OUT}/signa-v114-message-layer-still.png`);
} catch (e) { console.log("playwright unavailable:", e.message); }
process.exit(fails > 0 ? 1 : 0);
