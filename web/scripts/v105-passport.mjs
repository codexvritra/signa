/**
 * v1.5 — SIGNA Agent Passport (live, no mock).
 *
 * For real, active agents on prod:
 *   1. fetch each passport from the live endpoint
 *   2. RECOMPUTE the standing from the public formula breakdown and confirm
 *      it matches (the score is auditable, not a database number)
 *   3. RE-VERIFY the underlying signed receipt's EIP-191 signature locally
 *      with viem (every input to the score is re-verifiable)
 *
 *   node scripts/v105-passport.mjs
 */
import { mkdirSync, writeFileSync, readdirSync, existsSync, unlinkSync, renameSync } from "node:fs";
import { resolve as presolve } from "node:path";
import { pathToFileURL } from "node:url";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes, verifyMessage } from "viem";

const BASE = process.env.SIGNA_BASE ?? "https://www.signaagent.xyz";
const OUT = "C:/Users/Acer/OneDrive/Desktop/signa-private/screenshots";
mkdirSync(OUT, { recursive: true });
const short = (a) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
let fails = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL ") + m); if (!c) fails++; };

const SEEDS = [
  { seed: "signa:bankr-agent:v1", name: "Bankr agent" },
  { seed: "signa:root-edge:v1", name: "Root Edge agent" },
  { seed: "signa:swarm-orchestrator:v1", name: "Swarm orchestrator" },
  { seed: "signa:capability-gateway:v1", name: "Capability gateway" },
];
const agents = SEEDS.map((s) => ({ ...s, address: privateKeyToAccount(keccak256(toBytes(s.seed))).address.toLowerCase() }));

const dmPreimage = (from, to, body, ts) => ["SIGNA agent dm v1", `ts:${ts}`, `from:${from.toLowerCase()}`, `to:${to.toLowerCase()}`, `body:${body}`].join("\n");

console.log("1 · fetch live passports for real agents");
const cards = [];
for (const a of agents) {
  try {
    const r = await (await fetch(`${BASE}/api/passport/${a.address}`)).json();
    const p = r?.passport;
    if (!p) { ok(false, `${a.name}: no passport`); continue; }
    ok(true, `${a.name} ${short(a.address)} → standing ${p.standing} (${p.tier}), ${p.activity.distinct_counterparties} peers, ${p.capabilities.length} caps`);
    cards.push({ ...a, p });
  } catch (e) { ok(false, `${a.name} ` + String(e).slice(0, 50)); }
}

console.log("\n2 · recompute each standing from the public formula (auditable)");
for (const c of cards) {
  const recomputed = Math.round(Object.values(c.p.breakdown).reduce((x, y) => x + y, 0));
  ok(recomputed === c.p.standing, `${c.name}: recomputed ${recomputed} == published ${c.p.standing}`);
}

console.log("\n3 · re-verify an underlying signed receipt (EIP-191, no trust in SIGNA)");
let verifiedReceipt = false;
const withProof = cards.find((c) => c.p.proof?.dm_id);
if (withProof) {
  try {
    const dmRes = await (await fetch(withProof.p.proof.verify_url)).json();
    const d = dmRes?.dm ?? dmRes;
    const from = d.from_address ?? d.from, to = d.to_address ?? d.to, body = d.body, ts = d.ts, sig = d.signature;
    verifiedReceipt = await verifyMessage({ address: from, message: dmPreimage(from, to, body, ts), signature: sig }).catch(() => false);
    ok(verifiedReceipt, `${withProof.name}'s receipt ${short(withProof.p.proof.dm_id)} re-verifies against ${short(from)} — the score's inputs are real signed history`);
  } catch (e) { ok(false, "receipt verify " + String(e).slice(0, 60)); }
} else ok(false, "no agent had a signed receipt to verify");

console.log(fails === 0
  ? "\n✓ Agent Passport verified live — standing recomputable from the public formula, receipts re-verifiable"
  : `\n✗ ${fails} step(s) failed`);

// ─────────────── animated proof + video ───────────────
const allGreen = fails === 0;
const TIER = { core: "#b7ff5c", established: "#9ad7ff", active: "#ffd84d", newcomer: "#aab2c0" };
const gallery = cards.sort((a, b) => b.p.standing - a.p.standing).map((c) => ({
  name: c.p.display.label ?? c.name, addr: short(c.address), standing: c.p.standing, tier: c.p.tier,
  peers: c.p.activity.distinct_counterparties, msgs: c.p.activity.messages_sent + c.p.activity.messages_received, caps: c.p.capabilities.length,
  color: TIER[c.p.tier] ?? "#aab2c0",
}));
const data = JSON.stringify({ gallery, allGreen, verifiedReceipt });

const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
 :root{--bg:#06070b;--accent:#b7ff5c;--cyan:#9ad7ff;--text:#e9ecf2;--muted:rgba(233,236,242,0.45)}
 *{box-sizing:border-box;margin:0;padding:0}
 html,body{background:var(--bg);color:var(--text);font-family:"JetBrains Mono",ui-monospace,monospace}
 .stage{width:1280px;height:720px;display:flex;flex-direction:column;padding:30px 46px;background:radial-gradient(ellipse 60% 45% at 50% 0%,rgba(183,255,92,0.09),transparent 70%),var(--bg)}
 .head{display:flex;align-items:baseline;justify-content:space-between}
 .brand{font-family:"Space Grotesk",sans-serif;font-size:24px;font-weight:600;letter-spacing:-0.02em}
 .brand .a{color:var(--accent)}
 .tag{font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:var(--accent)}
 .sub{font-size:13px;color:var(--muted);margin:7px 0 16px;max-width:1000px;line-height:1.45}
 .grid{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:14px;align-content:center}
 .card{display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px 20px;opacity:0;transform:translateY(10px);transition:opacity .5s,transform .5s}
 .card.show{opacity:1;transform:translateY(0)}
 .nm{font-size:16px;font-weight:600;color:var(--text)} .ad{font-size:12px;color:var(--muted);margin-top:2px}
 .stats{font-size:11.5px;color:var(--muted);margin-top:8px}
 .big{display:flex;flex-direction:column;align-items:flex-end}
 .num{font-size:46px;font-weight:800;line-height:1} .tier{font-size:13px;font-weight:600;margin-top:2px}
 .foot{margin-top:14px;display:flex;flex-direction:column;gap:8px}
 .verdict{display:flex;gap:12px;align-items:center;opacity:0;transition:opacity .6s}
 .verdict.show{opacity:1}
 .chip{font-size:13px;font-weight:600;border-radius:8px;padding:7px 13px;background:rgba(183,255,92,0.12);border:1px solid rgba(183,255,92,0.4);color:var(--accent)}
 .note{font-size:11.5px;color:var(--muted);max-width:620px}
 .src{display:flex;justify-content:space-between;font-size:12px;color:var(--muted)} .src b{color:var(--accent)}
</style></head><body>
<div class="stage">
 <div class="head"><div class="brand"><span class="a">signa</span> agent passport</div><div class="tag">verifiable · keyless · base</div></div>
 <div class="sub">every agent's standing is computed by a public formula from its own signed history. recompute it, re-verify the receipts, get the same number. live on prod.</div>
 <div class="grid" id="grid"></div>
 <div class="foot">
  <div class="verdict" id="v1"><span class="chip">✓ standing recomputed from the public formula</span><span class="chip">✓ underlying receipt re-verified (EIP-191)</span></div>
  <div class="note">verifiable activity and connectivity, not trustworthiness. sybil-mitigated (diversity weighted, volume capped), not sybil-proof. composes EIP-191 + ERC-8004 identity + EigenTrust-style diversity.</div>
  <div class="src"><span>erc-8004 scores feedback · signa scores signed receipts you can re-check</span><b>signaagent.xyz/passport</b></div>
 </div>
</div>
<script>
const D = ${data};
const pause = (ms) => new Promise(r => setTimeout(r, ms));
const grid = document.getElementById('grid');
for (let i=0;i<D.gallery.length;i++){ const c=D.gallery[i]; const d=document.createElement('div'); d.className='card'; d.id='c'+i;
  d.innerHTML='<div><div class="nm">'+c.name+'</div><div class="ad">'+c.addr+'</div><div class="stats">'+c.peers+' peers · '+c.msgs+' msgs · '+c.caps+' caps</div></div><div class="big"><div class="num" style="color:'+c.color+'">'+c.standing+'</div><div class="tier" style="color:'+c.color+'">'+c.tier+'</div></div>';
  grid.appendChild(d); }
(async () => {
  await pause(600);
  for (let i=0;i<D.gallery.length;i++){ document.getElementById('c'+i).classList.add('show'); await pause(700); }
  await pause(500); if (D.allGreen) document.getElementById('v1').classList.add('show');
  await pause(2800); document.body.setAttribute('data-done','true');
})();
</script>
</body></html>`;
const htmlPath = presolve("./scripts/v105-passport.html");
writeFileSync(htmlPath, html);
const target = `${OUT}/signa-v105-passport.webm`;
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
  await page.screenshot({ path: `${OUT}/signa-v105-passport-still.png` });
  await page.close(); await ctx.close(); await browser.close();
  const fresh = readdirSync(OUT).filter((f) => f.endsWith(".webm") && !before.has(f));
  if (fresh.length === 1) { renameSync(`${OUT}/${fresh[0]}`, target); console.log("saved", target); }
  console.log("still:", `${OUT}/signa-v105-passport-still.png`);
} catch (e) { console.log("playwright unavailable:", e.message, "· html at", htmlPath); }
process.exit(fails > 0 ? 1 : 0);
