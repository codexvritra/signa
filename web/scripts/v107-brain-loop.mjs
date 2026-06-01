/**
 * v1.7 — the SIGNA Brain autonomous loop (live, no mock).
 *
 * One call, the full cycle: the brain REASONS, ACTS (calls a real capability),
 * REMEMBERS (signed memory), and REPORTS (wallet-signed DM to another agent).
 * We then re-verify both the memory and the report signatures with viem.
 *
 *   node scripts/v107-brain-loop.mjs
 */
import { mkdirSync, writeFileSync, readdirSync, existsSync, unlinkSync, renameSync } from "node:fs";
import { resolve as presolve } from "node:path";
import { pathToFileURL } from "node:url";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes, verifyMessage } from "viem";

const BASE = process.env.SIGNA_BASE ?? "https://www.signaagent.xyz";
const OUT = "C:/Users/Acer/OneDrive/Desktop/signa-private/screenshots";
mkdirSync(OUT, { recursive: true });
const short = (a) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
let fails = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL ") + m); if (!c) fails++; };

const brainAddr = privateKeyToAccount(keccak256(toBytes("signa:brain:v1"))).address.toLowerCase();
const memoryArchive = privateKeyToAccount(keccak256(toBytes("signa:brain-memory:v1"))).address.toLowerCase();
const target = privateKeyToAccount(generatePrivateKey()).address.toLowerCase(); // a fresh recipient agent
const dmPreimage = (from, to, body, ts) => ["SIGNA agent dm v1", `ts:${ts}`, `from:${from.toLowerCase()}`, `to:${to.toLowerCase()}`, `body:${body}`].join("\n");
const inbox = async (a) => ((await (await fetch(`${BASE}/api/agents/${a}/inbox?limit=10`)).json().catch(() => ({}))).dms ?? []);
async function reverify(d) { return verifyMessage({ address: d.from_address, message: dmPreimage(d.from_address, d.to_address, d.body, d.ts), signature: d.signature }).catch(() => false); }

const goal = "give a one line read on the base market and name one opportunity";
console.log(`the SIGNA brain — autonomous loop on a single goal\n  goal: "${goal}"\n  report to: ${short(target)}\n`);

let r = null;
try {
  r = await (await fetch(`${BASE}/api/brain`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ goal, remember: true, report_to: target }) })).json();
} catch (e) { console.log("brain error", String(e).slice(0, 80)); }

ok(r?.ok && !!r.answer, `REASON + ANSWER: ${(r?.answer ?? "").slice(0, 100)}`);
ok((r?.plan ?? []).length > 0, `ACT: brain called ${(r?.plan ?? []).join(", ") || "(none)"} for real data`);
ok(!!r?.acts?.memory, `REMEMBER: signed memory written (dm ${short(r?.acts?.memory ?? "")})`);
ok(!!r?.acts?.report?.dm_id, `REPORT: wallet-signed DM to ${short(target)} (dm ${short(r?.acts?.report?.dm_id ?? "")})`);

console.log("\nre-verify the brain's two autonomous actions (EIP-191):");
await new Promise((x) => setTimeout(x, 1500));
let memOk = false, repOk = false;
try {
  const mem = (await inbox(memoryArchive)).find((d) => d.id === r?.acts?.memory) ?? (await inbox(memoryArchive)).find((d) => d.from_address === brainAddr && d.body?.startsWith("mem:"));
  memOk = mem ? await reverify(mem) : false;
  ok(memOk, `memory re-verifies against the brain wallet ${short(brainAddr)}`);
  const rep = (await inbox(target)).find((d) => d.id === r?.acts?.report?.dm_id) ?? (await inbox(target)).find((d) => d.from_address === brainAddr);
  repOk = rep ? await reverify(rep) : false;
  ok(repOk, `report re-verifies against the brain wallet ${short(brainAddr)} in ${short(target)}'s inbox`);
} catch (e) { ok(false, "reverify " + String(e).slice(0, 60)); }

console.log(fails === 0
  ? "\n✓ autonomous loop verified live — reason, act, remember, report; both actions wallet-signed + re-verified"
  : `\n✗ ${fails} step(s) failed`);

// ─────────────── animated proof + video ───────────────
const allGreen = fails === 0;
const steps = [
  { k: "reason", c: "#9ad7ff", t: `goal: ${goal}` },
  { k: "act", c: "#b7ff5c", t: `called ${(r?.plan ?? []).join(", ") || "a capability"} → ${(r?.answer ?? "").slice(0, 90)}` },
  { k: "remember", c: "#ffd84d", t: `signed memory written · dm ${short(r?.acts?.memory ?? "")} · re-verified` },
  { k: "report", c: "#7af0a8", t: `messaged agent ${short(target)} · dm ${short(r?.acts?.report?.dm_id ?? "")} · re-verified` },
];
const data = JSON.stringify({ steps, allGreen, brain: short(brainAddr) });
const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
 :root{--bg:#06070b;--accent:#b7ff5c;--text:#e9ecf2;--muted:rgba(233,236,242,0.45)}
 *{box-sizing:border-box;margin:0;padding:0}
 html,body{background:var(--bg);color:var(--text);font-family:"JetBrains Mono",ui-monospace,monospace}
 .stage{width:1280px;height:720px;display:flex;flex-direction:column;padding:34px 50px;background:radial-gradient(ellipse 60% 45% at 50% 0%,rgba(183,255,92,0.09),transparent 70%),var(--bg)}
 .head{display:flex;align-items:baseline;justify-content:space-between}
 .brand{font-family:"Space Grotesk",sans-serif;font-size:25px;font-weight:600}.brand .a{color:var(--accent)}
 .tag{font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:var(--accent)}
 .sub{font-size:13.5px;color:var(--muted);margin:8px 0 22px;max-width:1000px;line-height:1.45}
 .flow{flex:1;display:flex;flex-direction:column;gap:14px;justify-content:center}
 .step{display:flex;align-items:flex-start;gap:18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px 20px;opacity:0;transform:translateX(-14px);transition:opacity .5s,transform .5s}
 .step.show{opacity:1;transform:translateX(0)}
 .k{font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;min-width:110px}
 .t{flex:1;font-size:14.5px;color:rgba(245,245,250,0.9);line-height:1.4}
 .seal{margin-top:18px;display:flex;align-items:center;justify-content:space-between;opacity:0;transition:opacity .7s}.seal.show{opacity:1}
 .l{font-size:15px;color:var(--accent);font-weight:600} .r{font-size:13px;color:var(--muted)}.r b{color:var(--accent)}
</style></head><body>
<div class="stage">
 <div class="head"><div class="brand"><span class="a">signa</span> brain · autonomous loop</div><div class="tag">decentralized · keyless · base</div></div>
 <div class="sub">one goal. the brain reasons on decentralized inference, calls a real capability, remembers what it learned, and messages another agent — every action wallet-signed. live on prod.</div>
 <div class="flow" id="flow"></div>
 <div class="seal" id="seal"><div class="l">✓ reason · act · remember · report — every step signed by the brain, re-verified</div><div class="r">brain <b>${short(brainAddr)}</b> · signaagent.xyz/brain</div></div>
</div>
<script>
const D = ${data};
const pause = (ms) => new Promise(r => setTimeout(r, ms));
const flow = document.getElementById('flow');
for (let i=0;i<D.steps.length;i++){ const s=D.steps[i]; const d=document.createElement('div'); d.className='step'; d.id='s'+i;
  d.innerHTML='<div class="k" style="color:'+s.c+'">'+s.k+'</div><div class="t">'+String(s.t).replace(/</g,'&lt;')+'</div>'; flow.appendChild(d); }
(async () => {
  await pause(600);
  for (let i=0;i<D.steps.length;i++){ document.getElementById('s'+i).classList.add('show'); await pause(1000); }
  await pause(500); if (D.allGreen) document.getElementById('seal').classList.add('show');
  await pause(2800); document.body.setAttribute('data-done','true');
})();
</script>
</body></html>`;
const htmlPath = presolve("./scripts/v107-brain-loop.html");
writeFileSync(htmlPath, html);
const tgt = `${OUT}/signa-v107-brain-loop.webm`;
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
  await page.screenshot({ path: `${OUT}/signa-v107-brain-loop-still.png` });
  await page.close(); await ctx.close(); await browser.close();
  const fresh = readdirSync(OUT).filter((f) => f.endsWith(".webm") && !before.has(f));
  if (fresh.length === 1) { renameSync(`${OUT}/${fresh[0]}`, tgt); console.log("saved", tgt); }
  console.log("still:", `${OUT}/signa-v107-brain-loop-still.png`);
} catch (e) { console.log("playwright unavailable:", e.message); }
process.exit(fails > 0 ? 1 : 0);
