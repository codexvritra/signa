/**
 * v1.3 — SIGNA Swarm (live, no mock).
 *
 * A keyless, cross-framework agent swarm runs a real mission on prod and
 * leaves a hash-chained, wallet-signed receipt that the LIVE public verifier
 * confirms — and that a tamper test correctly rejects.
 *
 * Agents (each only a wallet, no API keys):
 *   - Hermes orchestrator   (drives the mission)
 *   - Root Edge agent       (real Base market read via mcp.rootedge.ai)
 *   - Bankr agent           (real identity resolve via api.bankr.bot)
 *   - trader                (receives the assembled brief)
 *
 * Every inter-agent message is EIP-191 signed AND carries
 * prev = sha256(previous message signature), so the transcript is ordered
 * and tamper-evident. We scope the claim to transcript integrity + authorship
 * + order — not inference correctness.
 *
 *   node scripts/v103-swarm.mjs
 */
import { mkdirSync, writeFileSync, readdirSync, existsSync, unlinkSync, renameSync } from "node:fs";
import { resolve as presolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes, verifyMessage } from "viem";

const BASE = process.env.SIGNA_BASE ?? "https://www.signaagent.xyz";
const OUT = "C:/Users/Acer/OneDrive/Desktop/signa-private/screenshots";
mkdirSync(OUT, { recursive: true });
const short = (a) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
const SWARM_ID = Date.now().toString(36);
let fails = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL ") + m); if (!c) fails++; };

const dmPreimage = (from, to, body, ts) => ["SIGNA agent dm v1", `ts:${ts}`, `from:${from.toLowerCase()}`, `to:${to.toLowerCase()}`, `body:${body}`].join("\n");
const linkOf = (sig) => createHash("sha256").update(sig).digest("hex").slice(0, 12);

const messages = []; // the receipt, in order
async function swarmSend(account, to, content) {
  const seq = messages.length;
  const prev = seq === 0 ? "genesis" : linkOf(messages[seq - 1].signature);
  const body = `[swarm ${SWARM_ID} #${seq} prev ${prev}] ${content}`;
  const from = account.address.toLowerCase();
  const ts = Date.now();
  const signature = await account.signMessage({ message: dmPreimage(from, to, body, ts) });
  const r = await fetch(`${BASE}/api/agents/${from}/dm`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ from, to: to.toLowerCase(), body, ts, signature }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(`send seq ${seq} failed ${r.status}`);
  const msg = { from, to: to.toLowerCase(), ts, body, signature };
  messages.push(msg);
  return msg;
}
const intel = async (path) => { try { return await (await fetch(`${BASE}${path}`)).json(); } catch { return {}; } };

// ── keyless agents ──
const orchestrator = privateKeyToAccount(keccak256(toBytes("signa:swarm-orchestrator:v1")));
const rootAgent = privateKeyToAccount(keccak256(toBytes("signa:root-edge:v1")));
const bankrAgent = privateKeyToAccount(keccak256(toBytes("signa:bankr-agent:v1")));
const trader = privateKeyToAccount(generatePrivateKey());

console.log(`SIGNA Swarm ${SWARM_ID} — keyless, cross-framework, on prod\n`);

// ── run the mission, hash-chained ──
console.log("1 · the swarm runs a real mission (wallet-signed, hash-chained)");
let rootSummary = "", bankrAnswer = "", launch = "";
try {
  // seq0: orchestrator asks Root for the market read
  await swarmSend(orchestrator, rootAgent.address, "mission: assemble a base market brief for an incoming trader. give me the current read.");
  // Root pulls real intel and answers (seq1)
  rootSummary = (await intel(`/api/partners/root?tool=summary`))?.summary ?? "market read unavailable";
  await swarmSend(rootAgent, orchestrator.address, rootSummary);
  // seq2: orchestrator asks Bankr to resolve a reachable contact
  await swarmSend(orchestrator, bankrAgent.address, "resolve a reachable contact for the trader: @mac_eth");
  // Bankr resolves and answers (seq3)
  bankrAnswer = (await intel(`/api/partners/bankr/agent?q=${encodeURIComponent("resolve @mac_eth")}`))?.answer ?? "resolve unavailable";
  await swarmSend(bankrAgent, orchestrator.address, bankrAnswer);
  // orchestrator also grabs the latest launch for the brief
  launch = (await intel(`/api/partners/bankr/agent?q=${encodeURIComponent("latest base launch")}`))?.answer ?? "";
  // seq4: orchestrator delivers the assembled brief to the trader
  const brief = `BASE BRIEF (assembled by a keyless swarm). ${rootSummary} ${launch} ${bankrAnswer}`.slice(0, 900);
  await swarmSend(orchestrator, trader.address, brief);
  ok(messages.length === 5, `${messages.length} wallet-signed messages exchanged across 3 frameworks`);
} catch (e) { ok(false, "mission " + String(e).slice(0, 80)); }

// ── verify locally (the same check any viem client runs) ──
console.log("\n2 · verify the receipt locally (viem signatures + hash chain)");
let localOk = messages.length > 0;
for (let i = 0; i < messages.length; i++) {
  const m = messages[i];
  const sigOk = await verifyMessage({ address: m.from, message: dmPreimage(m.from, m.to, m.body, m.ts), signature: m.signature }).catch(() => false);
  const prev = i === 0 ? "genesis" : linkOf(messages[i - 1].signature);
  const chainOk = m.body.includes(`#${i} prev ${prev}`);
  if (!sigOk || !chainOk) localOk = false;
}
ok(localOk, `all ${messages.length} signatures valid + hash chain intact (head ${messages.length ? linkOf(messages[messages.length - 1].signature) : "—"})`);

// ── verify via the LIVE public endpoint ──
console.log("\n3 · verify via the live public verifier /api/swarm/verify");
let endpointVerdict = null;
try {
  const r = await fetch(`${BASE}/api/swarm/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages }) });
  endpointVerdict = await r.json();
  ok(endpointVerdict?.verified === true, `public verifier: verified=${endpointVerdict?.verified}, sigs=${endpointVerdict?.signaturesValid}, chain=${endpointVerdict?.chainIntact}`);
} catch (e) { ok(false, "verify endpoint " + String(e).slice(0, 60)); }

// ── tamper test: alter one message, expect rejection ──
console.log("\n4 · tamper test (alter one message, the chain must reject it)");
let tamperRejected = false;
try {
  const tampered = messages.map((m, i) => (i === 1 ? { ...m, body: m.body.replace("sentiment", "MANIPULATED") } : m));
  const r = await fetch(`${BASE}/api/swarm/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: tampered }) });
  const v = await r.json();
  tamperRejected = v?.verified === false;
  ok(tamperRejected, `tampered receipt correctly REJECTED (verified=${v?.verified}) — tamper-evidence is real`);
} catch (e) { ok(false, "tamper test " + String(e).slice(0, 60)); }

console.log(fails === 0
  ? "\n✓ SIGNA Swarm verified live — keyless cross-framework collaboration, signed + hash-chained, tamper-evident"
  : `\n✗ ${fails} step(s) failed`);

// save the receipt artifact (re-verifiable by anyone)
try { writeFileSync(`${OUT}/signa-v103-swarm-receipt.json`, JSON.stringify({ swarmId: SWARM_ID, head: messages.length ? linkOf(messages[messages.length - 1].signature) : null, messages }, null, 2)); } catch {}

// ─────────────── animated proof + video ───────────────
const allGreen = fails === 0;
const head = messages.length ? linkOf(messages[messages.length - 1].signature) : "—";
const FW = { [orchestrator.address.toLowerCase()]: "Hermes orchestrator", [rootAgent.address.toLowerCase()]: "Root Edge agent", [bankrAgent.address.toLowerCase()]: "Bankr agent", [trader.address.toLowerCase()]: "trader" };
const chain = messages.map((m, i) => ({
  seq: i,
  from: FW[m.from] ?? short(m.from),
  to: FW[m.to.toLowerCase()] ?? short(m.to),
  prev: i === 0 ? "genesis" : linkOf(messages[i - 1].signature),
  link: linkOf(m.signature),
  snippet: m.body.replace(/^\[swarm[^\]]*\]\s*/, "").slice(0, 96),
}));
const data = JSON.stringify({ SWARM_ID, head, chain, allGreen, tamperRejected });

const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
 :root{--bg:#06070b;--accent:#b7ff5c;--cyan:#9ad7ff;--gold:#ffd84d;--red:#ff6b8a;--text:#e9ecf2;--muted:rgba(233,236,242,0.45)}
 *{box-sizing:border-box;margin:0;padding:0}
 html,body{background:var(--bg);color:var(--text);font-family:"JetBrains Mono",ui-monospace,monospace}
 .stage{width:1280px;height:720px;display:flex;flex-direction:column;padding:28px 44px;background:radial-gradient(ellipse 60% 45% at 50% 0%,rgba(183,255,92,0.09),transparent 70%),var(--bg)}
 .head{display:flex;align-items:baseline;justify-content:space-between}
 .brand{font-family:"Space Grotesk",sans-serif;font-size:23px;font-weight:600;letter-spacing:-0.02em}
 .brand .a{color:var(--accent)}
 .tag{font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:var(--accent)}
 .sub{font-size:12.5px;color:var(--muted);margin:6px 0 14px}
 .chain{flex:1;display:flex;flex-direction:column;gap:7px;justify-content:center}
 .row{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-left:3px solid var(--accent);border-radius:9px;padding:8px 14px;opacity:0;transform:translateX(-12px);transition:opacity .4s,transform .4s}
 .row.show{opacity:1;transform:translateX(0)}
 .seq{font-size:12px;color:var(--accent);font-weight:700;min-width:26px}
 .route{font-size:12px;color:var(--cyan);min-width:230px}
 .route b{color:var(--text)}
 .snip{flex:1;font-size:12px;color:rgba(245,245,250,0.82);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .lk{font-size:10.5px;color:var(--muted);min-width:150px;text-align:right}
 .lk .p{color:rgba(245,245,250,0.3)}
 .foot{margin-top:12px;display:flex;flex-direction:column;gap:8px}
 .verdict{display:flex;align-items:center;gap:12px;opacity:0;transition:opacity .6s}
 .verdict.show{opacity:1}
 .chip{font-size:13px;font-weight:600;border-radius:8px;padding:7px 13px}
 .ok{background:rgba(183,255,92,0.12);border:1px solid rgba(183,255,92,0.4);color:var(--accent)}
 .bad{background:rgba(255,107,138,0.12);border:1px solid rgba(255,107,138,0.4);color:var(--red)}
 .meta{font-size:12px;color:var(--muted)} .meta b{color:var(--accent)}
 .src{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:4px} .src b{color:var(--accent)}
</style></head><body>
<div class="stage">
 <div class="head"><div class="brand"><span class="a">signa</span> swarm</div><div class="tag">keyless · signed · hash-chained · base</div></div>
 <div class="sub">a keyless cross-framework swarm assembling a base brief — every message wallet-signed and linked to the one before it. live on prod.</div>
 <div class="chain" id="chain"></div>
 <div class="foot">
  <div class="verdict" id="v1"><span class="chip ok">✓ receipt verified</span><span class="meta">every signature valid · hash chain intact · head <b id="head"></b></span></div>
  <div class="verdict" id="v2"><span class="chip bad">✗ tampered copy rejected</span><span class="meta">alter one message and the chain breaks — tamper-evident, re-verifiable by anyone</span></div>
  <div class="src"><span>identity from bankr · market read from root edge · transport + proof from signa</span><b>signaagent.xyz/swarm</b></div>
 </div>
</div>
<script>
const D = ${data};
const pause = (ms) => new Promise(r => setTimeout(r, ms));
const chain = document.getElementById('chain');
document.getElementById('head').textContent = D.head;
for (const c of D.chain) {
  const d = document.createElement('div'); d.className = 'row'; d.id = 'r'+c.seq;
  d.innerHTML = '<div class="seq">#'+c.seq+'</div><div class="route"><b>'+c.from+'</b> → '+c.to+'</div><div class="snip">'+c.snippet.replace(/</g,'&lt;')+'</div><div class="lk"><span class="p">prev '+c.prev+'</span><br>link '+c.link+'</div>';
  chain.appendChild(d);
}
(async () => {
  await pause(600);
  for (const c of D.chain) { document.getElementById('r'+c.seq).classList.add('show'); await pause(820); }
  await pause(500); if (D.allGreen) document.getElementById('v1').classList.add('show');
  await pause(900); if (D.tamperRejected) document.getElementById('v2').classList.add('show');
  await pause(2600); document.body.setAttribute('data-done','true');
})();
</script>
</body></html>`;

const htmlPath = presolve("./scripts/v103-swarm.html");
writeFileSync(htmlPath, html);
const target = `${OUT}/signa-v103-swarm.webm`;
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
  await page.screenshot({ path: `${OUT}/signa-v103-swarm-still.png` });
  await page.close(); await ctx.close(); await browser.close();
  const fresh = readdirSync(OUT).filter((f) => f.endsWith(".webm") && !before.has(f));
  if (fresh.length === 1) { renameSync(`${OUT}/${fresh[0]}`, target); console.log("saved", target); }
  console.log("still:", `${OUT}/signa-v103-swarm-still.png`);
} catch (e) { console.log("playwright unavailable:", e.message, "· html at", htmlPath); }
process.exit(fails > 0 ? 1 : 0);
