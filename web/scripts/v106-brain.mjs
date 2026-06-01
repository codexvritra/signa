/**
 * v1.6 — the SIGNA Brain (live, no mock).
 *
 * Give the brain three different goals and confirm it REASONS about which
 * capability each needs, INVOKES it for real, and ANSWERS from live data —
 * then re-verify the brain's signed receipt. Keyless, on prod.
 *
 *   node scripts/v106-brain.mjs
 */
import { mkdirSync, writeFileSync, readdirSync, existsSync, unlinkSync, renameSync } from "node:fs";
import { resolve as presolve } from "node:path";
import { pathToFileURL } from "node:url";
import { verifyMessage } from "viem";

const BASE = process.env.SIGNA_BASE ?? "https://www.signaagent.xyz";
const OUT = "C:/Users/Acer/OneDrive/Desktop/signa-private/screenshots";
mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL ") + m); if (!c) fails++; };

async function think(goal) {
  const r = await fetch(`${BASE}/api/brain`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ goal }) });
  return r.json();
}

const GOALS = [
  { goal: "what is the base market sentiment right now", expect: "root.market" },
  { goal: "resolve the handle @mac_eth to a wallet address i can message", expect: "bankr.resolve" },
  { goal: "what is the most recent token launch on base", expect: "bankr.launches" },
];

console.log("the SIGNA brain — reason, act, answer (keyless, live on prod)\n");
const cards = [];
let lastReceipt = null;
for (const g of GOALS) {
  try {
    const r = await think(g.goal);
    const tools = (r.tools ?? []).map((t) => t.cap);
    ok(r.ok && !!r.answer, `goal: "${g.goal}"`);
    console.log(`     plan: ${(r.plan ?? []).join(", ") || "(none)"}`);
    console.log(`     answer: ${(r.answer ?? "").slice(0, 140)}`);
    ok(tools.includes(g.expect) || (r.plan ?? []).some((p) => p.startsWith(g.expect)), `     brain chose the right tool (${g.expect})`);
    cards.push({ goal: g.goal, plan: (r.plan ?? []), answer: r.answer ?? "", tools });
    if (r.signature && r.verify?.preimage) lastReceipt = r;
  } catch (e) { ok(false, `${g.goal} — ${String(e).slice(0, 60)}`); }
}

console.log("\nre-verify the brain's signed receipt (EIP-191)");
let receiptOk = false;
if (lastReceipt) {
  receiptOk = await verifyMessage({ address: lastReceipt.brain, message: lastReceipt.verify.preimage, signature: lastReceipt.signature }).catch(() => false);
  ok(receiptOk, `brain receipt re-verifies against ${lastReceipt.brain.slice(0, 10)}… — the output is attributable + tamper-evident`);
} else ok(false, "no signed receipt returned");

console.log(fails === 0
  ? "\n✓ SIGNA Brain verified live — it reasons, picks the right real tools, answers from live data, and signs the result"
  : `\n✗ ${fails} step(s) failed`);

// ─────────────── animated proof + video ───────────────
const allGreen = fails === 0;
const data = JSON.stringify({ cards: cards.map((c) => ({ goal: c.goal, plan: c.plan.join(", "), answer: c.answer.slice(0, 150) })), allGreen, receiptOk });
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
 .cards{flex:1;display:flex;flex-direction:column;gap:12px;justify-content:center}
 .card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-left:3px solid var(--accent);border-radius:11px;padding:13px 18px;opacity:0;transform:translateY(10px);transition:opacity .5s,transform .5s}
 .card.show{opacity:1;transform:translateY(0)}
 .goal{font-size:14px;color:var(--text)} .goal b{color:var(--cyan)}
 .plan{font-size:12px;color:var(--accent);margin:5px 0}
 .ans{font-size:13px;color:rgba(245,245,250,0.82)}
 .foot{margin-top:14px;display:flex;flex-direction:column;gap:8px}
 .seal{display:flex;gap:12px;opacity:0;transition:opacity .6s}.seal.show{opacity:1}
 .chip{font-size:13px;font-weight:600;border-radius:8px;padding:7px 13px;background:rgba(183,255,92,0.12);border:1px solid rgba(183,255,92,0.4);color:var(--accent)}
 .note{font-size:11.5px;color:var(--muted);max-width:640px}
 .src{display:flex;justify-content:space-between;font-size:12px;color:var(--muted)}.src b{color:var(--accent)}
</style></head><body>
<div class="stage">
 <div class="head"><div class="brand"><span class="a">signa</span> brain</div><div class="tag">decentralized · keyless · base</div></div>
 <div class="sub">an agent's own brain. it reasons on decentralized inference, decides which capabilities to call, invokes them for real, and answers from live data. live on prod.</div>
 <div class="cards" id="cards"></div>
 <div class="foot">
  <div class="seal" id="seal"><span class="chip">✓ reasoned + picked the right real tools</span><span class="chip">✓ answered from live data</span><span class="chip">✓ result signed (EIP-191)</span></div>
  <div class="note">tool outputs are real live data; the brain signs what it produced. a signature proves provenance, not correctness. inference is x402-paid in production — the agent holds no api key.</div>
  <div class="src"><span>a brain with a useful os, not a rented mouth behind an api key</span><b>signaagent.xyz/brain</b></div>
 </div>
</div>
<script>
const D = ${data};
const pause = (ms) => new Promise(r => setTimeout(r, ms));
const wrap = document.getElementById('cards');
for (let i=0;i<D.cards.length;i++){ const c=D.cards[i]; const d=document.createElement('div'); d.className='card'; d.id='c'+i;
  d.innerHTML='<div class="goal">goal: <b>'+c.goal.replace(/</g,'&lt;')+'</b></div><div class="plan">brain reasoned → called '+(c.plan||'(no tools)')+'</div><div class="ans">'+c.answer.replace(/</g,'&lt;')+'</div>';
  wrap.appendChild(d); }
(async () => {
  await pause(600);
  for (let i=0;i<D.cards.length;i++){ document.getElementById('c'+i).classList.add('show'); await pause(950); }
  await pause(500); if (D.allGreen) document.getElementById('seal').classList.add('show');
  await pause(2800); document.body.setAttribute('data-done','true');
})();
</script>
</body></html>`;
const htmlPath = presolve("./scripts/v106-brain.html");
writeFileSync(htmlPath, html);
const target = `${OUT}/signa-v106-brain.webm`;
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
  await page.screenshot({ path: `${OUT}/signa-v106-brain-still.png` });
  await page.close(); await ctx.close(); await browser.close();
  const fresh = readdirSync(OUT).filter((f) => f.endsWith(".webm") && !before.has(f));
  if (fresh.length === 1) { renameSync(`${OUT}/${fresh[0]}`, target); console.log("saved", target); }
  console.log("still:", `${OUT}/signa-v106-brain-still.png`);
} catch (e) { console.log("playwright unavailable:", e.message, "· html at", htmlPath); }
process.exit(fails > 0 ? 1 : 0);
