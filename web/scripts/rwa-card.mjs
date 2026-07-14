// Render the SIGNA Proof-of-Stock card from a LIVE attestation run.
//   run from web/:  node scripts/rwa-card.mjs
//   local:          BASE=http://localhost:3001 node scripts/rwa-card.mjs
import { readFileSync, copyFileSync } from "node:fs";
const BASE = process.env.BASE ?? "https://www.signaagent.xyz";
const logoUri = `data:image/png;base64,${readFileSync("public/signa-logo-200.png").toString("base64")}`;
const sa = (a, n = 10) => (a ? `${a.slice(0, n)}…${a.slice(-6)}` : "—");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const demo = await (await fetch(`${BASE}/api/rwa/demo`)).json();
const reg = await (await fetch(`${BASE}/api/rwa?market=0`)).json();
console.log("live demo:", { ok: demo.ok, subject: demo.subject, impostors: demo.impostors?.count, attested: reg.count });

const a = demo.attestation ?? {};
const stepMeta = {
  read: ["1", "read", "#6ea2ff"],
  sign: ["2", "sign", "#a98bff"],
  "verify-signature": ["3", "verify signature", "#f0b3ff"],
  "replay-onchain": ["4", "replay onchain", "#5ee68f"],
};
const steps = (demo.steps ?? [])
  .map((s) => {
    const [n, h, c] = stepMeta[s.step] ?? ["•", s.step, "#6ea2ff"];
    return `<div class="step"><span class="n" style="color:${c};border-color:${c}66">${n}</span><div class="st"><div class="sh">${h} <span class="by">— ${esc(s.detail)}</span></div></div><span class="rv">${s.ok ? "✓" : "×"}</span></div>`;
  })
  .join("");

const imps = (demo.impostors?.items ?? [])
  .slice(0, 4)
  .map((i) => `<span class="imp">${esc(i.symbol)} <em>${sa(i.address, 8)}</em></span>`)
  .join("");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1600px;height:900px}
  body{font-family:'Segoe UI',-apple-system,system-ui,sans-serif;background:#070b12;color:#eef2fb;overflow:hidden;position:relative}
  .glow{position:absolute;border-radius:50%;filter:blur(150px);opacity:.5}
  .g1{width:820px;height:820px;left:-220px;top:-260px;background:#3b6fe0}
  .g2{width:760px;height:760px;right:-230px;bottom:-280px;background:#8b5cf6}
  .frame{position:absolute;inset:0;padding:52px 84px;display:flex;flex-direction:column}
  .top{display:flex;align-items:center;gap:16px}
  .top img{width:50px;height:50px;border-radius:13px}
  .wm{font-size:27px;font-weight:800}
  .pill{margin-left:auto;font-size:15px;color:#9fb0d0;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:8px 16px}
  .pill b{color:#6ea2ff}
  h1{font-size:76px;line-height:.98;font-weight:800;letter-spacing:-2.6px;margin-top:10px}
  h1 .grad{background:linear-gradient(100deg,#6ea2ff,#a98bff);-webkit-background-clip:text;background-clip:text;color:transparent}
  .sub{font-size:21px;color:#cdd8f0;margin-top:10px;max-width:1120px;line-height:1.4}
  .sub b{color:#fff}
  .steps{margin-top:18px;display:flex;flex-direction:column;gap:9px}
  .step{display:flex;align-items:center;gap:16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:13px;padding:11px 20px}
  .step .n{width:38px;height:38px;flex:0 0 38px;border-radius:50%;background:#0d1422;border:1.5px solid;font-weight:800;font-size:18px;display:flex;align-items:center;justify-content:center}
  .sh{font-size:20px;font-weight:700}
  .by{font-size:16px;color:#9fb0d0;font-weight:500}
  .rv{margin-left:auto;font-size:19px;color:#5ee68f;font-weight:700}
  .imps{margin-top:15px;border:1px solid rgba(251,191,36,.28);background:rgba(251,191,36,.06);border-radius:13px;padding:13px 20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .imps .lab{font-size:17px;color:#fcd34d;font-weight:700}
  .imp{font-size:14px;color:#b9a271;border:1px solid rgba(251,191,36,.22);border-radius:8px;padding:4px 10px;font-weight:600}
  .imp em{font-style:normal;color:#8f7f5c;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px}
  .proof{margin-top:14px;border:1px solid rgba(94,230,143,.4);background:rgba(34,201,138,.09);border-radius:13px;padding:14px 20px;font-size:16px;color:#dfeaf7}
  .proof b{color:#5ee68f}
  .proof .m{font-size:13px;color:#86a0c0;font-family:ui-monospace,Menlo,Consolas,monospace;margin-top:5px}
  .foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;padding-top:14px;border-top:1px solid rgba(255,255,255,.08)}
  .foot .site{font-size:23px;font-weight:700;color:#cdd8f0}
  .foot .t{font-size:18px;color:#8aa0c8}.foot .t b{color:#a98bff}
</style></head><body>
  <div class="glow g1"></div><div class="glow g2"></div>
  <div class="frame">
    <div class="top"><img src="${logoUri}"><span class="wm">SIGNA</span><span class="pill">Robinhood Chain · stock tokens — <b>${reg.count ?? 24} attested at one block</b></span></div>
    <h1>Robinhood tokenizes the stock.<br><span class="grad">SIGNA proves it&#39;s real.</span></h1>
    <div class="sub">The chain is permissionless, so every real Stock Token has impostors squatting its ticker. SIGNA signs which contract is canonical and what its supply was at a block — <b>checkable two independent ways</b>.</div>
    <div class="steps">${steps}</div>
    <div class="imps"><span class="lab">${demo.impostors?.count ?? 0} contracts squat the ${esc(a.ticker ?? "NVDA")} ticker</span>${imps}<span class="imp" style="border-color:rgba(94,230,143,.5);color:#5ee68f">real → <em style="color:#5ee68f">${sa(demo.canonical_contract, 8)}</em></span></div>
    <div class="proof">
      <b>${demo.ok ? "signature recovers to SIGNA’s attestor — and the onchain replay matches" : "attestation"}</b> — leg 1 the vouch, leg 2 the state. Change one digit and recovery returns a different address.
      <div class="m">${esc(a.ticker)} ${esc(a.supply_display)} supply @ block ${esc(a.block)} · canonical ${sa(demo.canonical_contract, 12)} · attestor ${sa(demo.attestor, 12)} · chain 4663</div>
    </div>
    <div class="foot"><span class="site">signaagent.xyz/rwa</span><span class="t">the proof layer for tokenized stocks — <b>don&#39;t trust, verify.</b></span></div>
  </div>
</body></html>`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const OUT = "C:/Users/Acer/OneDrive/Desktop/signa-proof-of-stock.png";
await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1600, height: 900 } });
await browser.close();
for (const d of ["C:/Users/Acer/Desktop", "C:/Users/Acer/Downloads"]) { try { copyFileSync(OUT, `${d}/signa-proof-of-stock.png`); } catch {} }
console.log("WROTE", OUT);
