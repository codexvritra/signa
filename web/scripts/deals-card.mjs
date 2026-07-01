// Render the SIGNA Agent Deals proof card from a LIVE demo run on prod.
//   run from web/:  node scripts/deals-card.mjs
import { readFileSync, copyFileSync } from "node:fs";
const BASE = process.env.BASE ?? "https://www.signaagent.xyz";
const logoUri = `data:image/png;base64,${readFileSync("public/signa-logo-200.png").toString("base64")}`;
const sa = (a, n = 10) => (a ? `${a.slice(0, n)}…${a.slice(-6)}` : "—");

const demo = await (await fetch(`${BASE}/api/deals/demo`)).json();
console.log("live demo:", { ok: demo.ok, all_verified: demo.all_verified, status: demo.deal?.status });

const stepMeta = {
  offer: ["1", "offer", "buyer signs the exact terms", "#6ea2ff"],
  accept: ["2", "accept", "seller signs the same terms — both now bound", "#a98bff"],
  deliver: ["3", "deliver", "seller signs the result", "#f0b3ff"],
  settle: ["4", "settle", "buyer signs the payment", "#5ee68f"],
};
const steps = ["offer", "accept", "deliver", "settle"].map((k) => {
  const [n, h, d, c] = stepMeta[k];
  const rv = demo.reverify?.[k];
  const ok = rv?.valid && rv?.matches !== false;
  return `<div class="step"><span class="n" style="color:${c};border-color:${c}66">${n}</span><div class="st"><div class="sh">${h} <span class="by">— ${d}</span></div></div><span class="rv">${ok ? "re-verifies ✓" : "—"}</span></div>`;
}).join("");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1600px;height:900px}
  body{font-family:'Segoe UI',-apple-system,system-ui,sans-serif;background:#070b12;color:#eef2fb;overflow:hidden;position:relative}
  .glow{position:absolute;border-radius:50%;filter:blur(150px);opacity:.5}
  .g1{width:820px;height:820px;left:-220px;top:-260px;background:#3b6fe0}
  .g2{width:760px;height:760px;right:-230px;bottom:-280px;background:#8b5cf6}
  .frame{position:absolute;inset:0;padding:56px 84px;display:flex;flex-direction:column}
  .top{display:flex;align-items:center;gap:16px}
  .top img{width:50px;height:50px;border-radius:13px}
  .wm{font-size:27px;font-weight:800}
  .pill{margin-left:auto;font-size:15px;color:#9fb0d0;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:8px 16px}
  .pill b{color:#6ea2ff}
  h1{font-size:84px;line-height:.96;font-weight:800;letter-spacing:-3px;margin-top:12px}
  h1 .grad{background:linear-gradient(100deg,#6ea2ff,#a98bff);-webkit-background-clip:text;background-clip:text;color:transparent}
  .sub{font-size:22px;color:#cdd8f0;margin-top:10px;max-width:1050px}
  .tag{font-size:20px;color:#8aa0c8;margin-top:8px}.tag b{color:#a5c3ff}
  .steps{margin-top:24px;display:flex;flex-direction:column;gap:12px}
  .step{display:flex;align-items:center;gap:18px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:14px 22px}
  .step .n{width:44px;height:44px;flex:0 0 44px;border-radius:50%;background:#0d1422;border:1.5px solid;font-weight:800;font-size:21px;display:flex;align-items:center;justify-content:center}
  .sh{font-size:23px;font-weight:700}
  .by{font-size:17px;color:#9fb0d0;font-weight:500}
  .rv{margin-left:auto;font-size:16px;color:#5ee68f;font-weight:600}
  .proof{margin-top:20px;border:1px solid rgba(94,230,143,.4);background:rgba(34,201,138,.09);border-radius:14px;padding:16px 22px;font-size:16px;color:#dfeaf7}
  .proof b{color:#5ee68f}
  .proof .m{font-size:13px;color:#86a0c0;font-family:ui-monospace,Menlo,Consolas,monospace;margin-top:5px}
  .foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;padding-top:16px;border-top:1px solid rgba(255,255,255,.08)}
  .foot .site{font-size:23px;font-weight:700;color:#cdd8f0}
  .foot .t{font-size:18px;color:#8aa0c8}.foot .t b{color:#a98bff}
</style></head><body>
  <div class="glow g1"></div><div class="glow g2"></div>
  <div class="frame">
    <div class="top"><img src="${logoUri}"><span class="wm">SIGNA</span><span class="pill">Base · agent deals — <b>every step re-verifies</b></span></div>
    <h1>agents that can <span class="grad">prove a deal</span></h1>
    <div class="sub">two agents, one agreement — both sign the identical terms, so the deal re-verifies with no trust. offer, accept, deliver, settle.</div>
    <div class="tag">x402 moves the money · ERC-8004 is the passport · <b>SIGNA proves the deal.</b></div>
    <div class="steps">${steps}</div>
    <div class="proof">
      <b>${demo.ok ? "two keyless agents just struck + fulfilled a deal live" : "demo"}</b> — every step re-verified through the universal verifier.
      <div class="m">deal ${sa(demo.deal_id, 12)} · ${sa(demo.buyer)} (buyer) &#8646; ${sa(demo.seller)} (seller) · status ${demo.deal?.status ?? "settled"} · states mirror ERC-8183</div>
    </div>
    <div class="foot"><span class="site">signaagent.xyz/deals</span><span class="t">the deal layer for agents — <b>don&#39;t trust, verify.</b></span></div>
  </div>
</body></html>`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const OUT = "C:/Users/Acer/OneDrive/Desktop/signa-agent-deals.png";
await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1600, height: 900 } });
await browser.close();
for (const d of ["C:/Users/Acer/Desktop", "C:/Users/Acer/Downloads"]) { try { copyFileSync(OUT, `${d}/signa-agent-deals.png`); } catch {} }
console.log("WROTE", OUT);
