/**
 * v2.7 — THE CHALLENGE (live on prod, no mock).
 *
 * Proves the falsifiable core: the published genuine message recovers to the
 * challenge target; a different wallet signing ANYTHING recovers that wallet,
 * never the target; resubmitting the genuine pair is not a forgery; and the
 * public ledger increments while forgeries stay at zero. The verifier (viem)
 * decides — we can't fake a win.
 *
 *   node scripts/v115-challenge.mjs
 */
import { mkdirSync, writeFileSync, readdirSync, existsSync, unlinkSync, renameSync } from "node:fs";
import { resolve as presolve } from "node:path";
import { pathToFileURL } from "node:url";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { recoverMessageAddress } from "viem";

const BASE = process.env.SIGNA_BASE ?? "https://www.signaagent.xyz";
const OUT = "C:/Users/Acer/OneDrive/Desktop/signa-private/screenshots";
mkdirSync(OUT, { recursive: true });
const short = (a) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
let fails = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL ") + m); if (!c) fails++; };
const submit = async (message, signature, submitter) => (await fetch(`${BASE}/api/challenge/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, signature, submitter }) })).json().catch(() => ({}));

console.log(`THE SIGNA CHALLENGE — forge our signature, break the layer (live on ${BASE})\n`);

let ch = {};
try { ch = await (await fetch(`${BASE}/api/challenge`)).json(); } catch (e) { console.log("challenge error", String(e).slice(0, 100)); }
const target = (ch?.target ?? "").toLowerCase();
const genuine = ch?.genuine ?? {};
ok(!!target && !!genuine.message && !!genuine.signature, `published genuine target ${short(target)} + signed message`);

// 1. anyone re-verifies the genuine pair locally → recovers the target
let gRec = null;
try { gRec = (await recoverMessageAddress({ message: genuine.message, signature: genuine.signature })).toLowerCase(); } catch { /* */ }
ok(gRec === target, `VERIFY: genuine pair recovers the target locally with viem (${short(gRec)})`);

const before = ch?.ledger?.attempts ?? 0;

// 2. a different wallet signs the SAME genuine message → recovers that wallet, not us
const atk = privateKeyToAccount(generatePrivateKey());
const s2 = await atk.signMessage({ message: genuine.message });
const r2 = await submit(genuine.message, s2, atk.address);
ok(r2?.win === false && r2?.recovered === atk.address.toLowerCase(), `ATTEMPT: attacker signs the genuine text → recovers ${short(r2?.recovered)} (the attacker), not the target — no forgery`);

// 3. resubmit the GENUINE pair → recovers target, but it's the genuine message, not a forgery
const r3 = await submit(genuine.message, genuine.signature, "replayer");
ok(r3?.win === false && r3?.recovered === target, `ATTEMPT: replaying the genuine pair recovers the target but is not a forgery (caught)`);

// 4. attacker signs NOVEL text → recovers attacker, not target
const s4 = await atk.signMessage({ message: "i hereby forge the signa challenge wallet " + atk.address });
const r4 = await submit("i hereby forge the signa challenge wallet " + atk.address, s4, atk.address);
ok(r4?.win === false && r4?.recovered === atk.address.toLowerCase(), `ATTEMPT: attacker signs novel text → recovers ${short(r4?.recovered)}, never the target`);

// 5. ledger moved, forgeries still zero
let after = {};
try { after = (await (await fetch(`${BASE}/api/challenge`)).json())?.ledger ?? {}; } catch { /* */ }
ok((after.attempts ?? 0) >= before + 3 && (after.forged ?? 0) === 0, `LEDGER: attempts ${before} → ${after.attempts}, forgeries ${after.forged} — the signatures hold`);

console.log(fails === 0
  ? "\n✓ the challenge holds — genuine pair re-verifies, every forgery attempt recovers the attacker not the target, ledger public, forgeries zero"
  : `\n✗ ${fails} step(s) failed`);

// ─────────────── animated proof + video ───────────────
const allGreen = fails === 0;
const steps = [
  { k: "the claim", c: "#9ad7ff", t: `every signa message recovers to exactly one address · target ${short(target)}` },
  { k: "verify", c: "#34d399", t: `the genuine pair recovers the target locally with viem — no server trust` },
  { k: "attack", c: "#fbbf24", t: `a different wallet signs anything → recovers ${short(r2?.recovered)} (itself), never us` },
  { k: "the ledger", c: "#7c9cff", t: `${after?.attempts ?? "?"} attempts · ${after?.forged ?? 0} forgeries · you win by breaking ECDSA, we win by zero` },
];
const data = JSON.stringify({ steps, allGreen });
const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
 :root{--bg:#0a0a0f;--accent:#5b8def;--accent2:#8b5cf6;--text:#e9ecf2;--muted:rgba(233,236,242,0.45)}
 *{box-sizing:border-box;margin:0;padding:0}
 html,body{background:var(--bg);color:var(--text);font-family:"JetBrains Mono",ui-monospace,monospace}
 .stage{width:1280px;height:720px;display:flex;flex-direction:column;padding:34px 50px;background:radial-gradient(ellipse 60% 45% at 50% 0%,rgba(91,141,239,0.13),transparent 70%),var(--bg)}
 .head{display:flex;align-items:baseline;justify-content:space-between}
 .brand{font-family:"Space Grotesk",sans-serif;font-size:25px;font-weight:600}.brand .a{color:var(--accent)}
 .tag{font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:var(--accent2)}
 .sub{font-size:13.5px;color:var(--muted);margin:8px 0 22px;max-width:1010px;line-height:1.45}
 .flow{flex:1;display:flex;flex-direction:column;gap:14px;justify-content:center}
 .step{display:flex;align-items:flex-start;gap:18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px 20px;opacity:0;transform:translateX(-14px);transition:opacity .5s,transform .5s}
 .step.show{opacity:1;transform:translateX(0)}
 .k{font-size:13px;font-weight:700;letter-spacing:0.06em;min-width:120px}
 .t{flex:1;font-size:14.5px;color:rgba(245,245,250,0.9);line-height:1.4}
 .seal{margin-top:18px;display:flex;align-items:center;justify-content:space-between;opacity:0;transition:opacity .7s}.seal.show{opacity:1}
 .l{font-size:15px;color:var(--accent);font-weight:600} .r{font-size:13px;color:var(--muted)}.r b{color:var(--accent)}
</style></head><body>
<div class="stage">
 <div class="head"><div class="brand"><span class="a">signa</span> challenge · forge our signature, break the layer</div><div class="tag">keyless · wallet-signed · base</div></div>
 <div class="sub">every message on signa is an eip-191 wallet signature that recovers to exactly one address. we published a genuine one and dared anyone to forge it: a signature that recovers our address over text they choose. the verdict is decided by viem, not by us. live on prod.</div>
 <div class="flow" id="flow"></div>
 <div class="seal" id="seal"><div class="l">✓ genuine re-verifies · every attack recovers the attacker, never us · forgeries: zero</div><div class="r">signaagent.xyz/<b>challenge</b></div></div>
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
const htmlPath = presolve("./scripts/v115-challenge.html");
writeFileSync(htmlPath, html);
const tgt = `${OUT}/signa-v115-challenge.webm`;
if (existsSync(tgt)) unlinkSync(tgt);
const beforeW = new Set(readdirSync(OUT).filter((f) => f.endsWith(".webm")));
try {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } }, colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(htmlPath).href);
  await page.waitForFunction(() => document.body.getAttribute("data-done") === "true", { timeout: 120000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/signa-v115-challenge-still.png` });
  await page.close(); await ctx.close(); await browser.close();
  const fresh = readdirSync(OUT).filter((f) => f.endsWith(".webm") && !beforeW.has(f));
  if (fresh.length === 1) { renameSync(`${OUT}/${fresh[0]}`, tgt); console.log("saved", tgt); }
  console.log("still:", `${OUT}/signa-v115-challenge-still.png`);
} catch (e) { console.log("playwright unavailable:", e.message); }
process.exit(fails > 0 ? 1 : 0);
