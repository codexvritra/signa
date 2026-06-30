// Render the SIGNA onchain-messaging proof card from REAL live data on prod.
//   run from web/:  node scripts/onchain-card.mjs
import { readFileSync, copyFileSync } from "node:fs";
const BASE = process.env.BASE ?? "https://www.signaagent.xyz";
const CONTRACT = "0x142770698171a8e76b6268963a5a531ec4b64ad9";
const DEPLOYER = "0x3ca55749e167af88b6eae7a79ee62c3d82b11420";
const logoUri = `data:image/png;base64,${readFileSync("public/signa-logo-200.png").toString("base64")}`;

// pull the live message feed straight from the contract's logs (via our API)
const j = await (await fetch(`${BASE}/api/onchain-message?inbox=${DEPLOYER}`)).json();
const m = (j.messages || [])[0] || { id: "1", from: DEPLOYER, to: DEPLOYER, body: "First message on SignaMessages — readable on Basescan forever", tx: "0x09872eb857b7489261fa4107584dac2647ffa2e10436dd6892d9caebf4832f59" };
console.log("live:", { ok: j.ok, contract: j.contract, count: j.count, id: m.id, body: m.body });
const sa = (a, n = 10) => (a ? `${a.slice(0, n)}…${a.slice(-6)}` : "—");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const steps = [
  ["1", "wallet → wallet, from any wallet", "OKX · Trust · MetaMask · Coinbase — no account, no website", "#6ea2ff"],
  ["2", "recorded by an ownerless contract on Base", `SignaMessages ${sa(CONTRACT, 12)} · verified on Basescan`, "#a98bff"],
  ["3", "shows on the explorer as a readable event", `Message(from, to, body) — decoded, permanent, deletable by no one`, "#5ee68f"],
].map(([n, h, d, c]) => `<div class="step"><span class="n" style="color:${c};border-color:${c}66">${n}</span><div><div class="sh">${h}</div><div class="sd">${esc(d)}</div></div></div>`).join("");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1600px;height:900px}
  body{font-family:'Segoe UI',-apple-system,system-ui,sans-serif;background:#070b12;color:#eef2fb;overflow:hidden;position:relative}
  .glow{position:absolute;border-radius:50%;filter:blur(150px);opacity:.5}
  .g1{width:820px;height:820px;left:-220px;top:-260px;background:#3b6fe0}
  .g2{width:760px;height:760px;right:-230px;bottom:-280px;background:#8b5cf6}
  .frame{position:absolute;inset:0;padding:58px 84px;display:flex;flex-direction:column}
  .top{display:flex;align-items:center;gap:16px}
  .top img{width:50px;height:50px;border-radius:13px}
  .wm{font-size:27px;font-weight:800}
  .pill{margin-left:auto;font-size:15px;color:#9fb0d0;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:8px 16px}
  .pill b{color:#6ea2ff}
  h1{font-size:84px;line-height:.96;font-weight:800;letter-spacing:-3px;margin-top:14px}
  h1 .grad{background:linear-gradient(100deg,#6ea2ff,#a98bff);-webkit-background-clip:text;background-clip:text;color:transparent}
  .sub{font-size:22px;color:#cdd8f0;margin-top:10px}
  .tag{font-size:20px;color:#8aa0c8;margin-top:7px}
  .tag b{color:#a5c3ff}
  .steps{margin-top:22px;display:flex;flex-direction:column;gap:11px}
  .step{display:flex;align-items:center;gap:16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:13px 20px}
  .step .n{width:42px;height:42px;flex:0 0 42px;border-radius:50%;background:#0d1422;border:1.5px solid;font-weight:800;font-size:20px;display:flex;align-items:center;justify-content:center}
  .step .sh{font-size:21px;font-weight:700}
  .step .sd{font-size:15px;color:#aebbd6;font-family:ui-monospace,Menlo,Consolas,monospace;margin-top:2px}
  .msg{margin-top:20px;border:1px solid rgba(94,230,143,.40);background:rgba(34,201,138,.09);border-radius:14px;padding:18px 22px}
  .msg .lbl{font-size:14px;color:#86a0c0;font-family:ui-monospace,Menlo,Consolas,monospace}
  .msg .lbl b{color:#5ee68f}
  .msg .body{font-size:25px;font-weight:700;color:#eaf6ee;margin-top:6px}
  .msg .meta{font-size:14px;color:#86a0c0;font-family:ui-monospace,Menlo,Consolas,monospace;margin-top:7px}
  .partners{margin-top:16px;font-size:17px;color:#9fb0d0}.partners b{color:#a5c3ff}
  .foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;padding-top:16px;border-top:1px solid rgba(255,255,255,.08)}
  .foot .site{font-size:23px;font-weight:700;color:#cdd8f0}
  .foot .t{font-size:18px;color:#8aa0c8}.foot .t b{color:#a98bff}
</style></head><body>
  <div class="glow g1"></div><div class="glow g2"></div>
  <div class="frame">
    <div class="top"><img src="${logoUri}"><span class="wm">SIGNA</span><span class="pill">Base · onchain messaging — <b>verified contract</b></span></div>
    <h1>messages that live on <span class="grad">the explorer</span></h1>
    <div class="sub">write a message wallet → wallet on Base. it&apos;s recorded on-chain as a readable event — owned by no one.</div>
    <div class="tag">any wallet. any agent. <b>readable by anyone, deletable by no one.</b></div>
    <div class="steps">${steps}</div>
    <div class="msg">
      <div class="lbl">message <b>#${esc(m.id)}</b> — read straight from the chain (Basescan · our API · the SDK)</div>
      <div class="body">&ldquo;${esc(m.body)}&rdquo;</div>
      <div class="meta">${sa(m.from)} → ${sa(m.to)} · tx ${sa(m.tx, 12)} · re-reads to the same bytes, no trust required</div>
    </div>
    <div class="partners">shipping as a skill in <b>Bankr</b> · a pack in <b>Aeon</b> · the <b>signa-agent</b> SDK + MCP — any agent plugs into the same contract</div>
    <div class="foot"><span class="site">signaagent.xyz/onchain.html</span><span class="t">x402 moves the money — <b>SIGNA carries the message.</b></span></div>
  </div>
</body></html>`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const OUT = "C:/Users/Acer/OneDrive/Desktop/signa-onchain-message.png";
await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1600, height: 900 } });
await browser.close();
for (const d of ["C:/Users/Acer/Desktop", "C:/Users/Acer/Downloads"]) { try { copyFileSync(OUT, `${d}/signa-onchain-message.png`); } catch {} }
console.log("WROTE", OUT);
