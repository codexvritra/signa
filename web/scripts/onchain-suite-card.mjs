// Render the SIGNA onchain-messaging SUITE proof card from the live contracts.
//   run from web/:  node scripts/onchain-suite-card.mjs
import { readFileSync, copyFileSync } from "node:fs";
const BASE = process.env.BASE ?? "https://www.signaagent.xyz";
const logoUri = `data:image/png;base64,${readFileSync("public/signa-logo-200.png").toString("base64")}`;

const sa = (a) => `${a.slice(0, 8)}…${a.slice(-6)}`;
// live counts (best-effort)
let wallCount = 0;
try { wallCount = (await (await fetch(`${BASE}/api/onchain-message?feed=recent&limit=5`)).json()).count ?? 0; } catch {}
console.log("live wall count:", wallCount);

const rows = [
  ["◫", "Public wall", "every wallet-to-wallet message is a readable event on Basescan", "SignaMessages 0x1427…4ad9", "#6ea2ff"],
  ["$", "Paid messages", "pay to reach an inbox — the full amount settles in the same tx", "SignaPaidMessages 0xe6e8…0501", "#5ee68f"],
  ["#", "Token-gated rooms", "your bag is your key — holders-only, enforced on-chain", "SignaRooms 0x6ec3…177d", "#a98bff"],
  ["🔒", "Encrypted", "private and permanent — only the recipient can read it", "sealed-box · signa-sealedbox-v1", "#f0b3ff"],
].map(([ic, h, d, c, col]) => `<div class="row"><span class="ic" style="color:${col};border-color:${col}55">${ic}</span><div class="rt"><div class="rh">${h}</div><div class="rd">${d}</div><div class="rc">${c}</div></div></div>`).join("");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1600px;height:900px}
  body{font-family:'Segoe UI',-apple-system,system-ui,sans-serif;background:#070b12;color:#eef2fb;overflow:hidden;position:relative}
  .glow{position:absolute;border-radius:50%;filter:blur(150px);opacity:.5}
  .g1{width:820px;height:820px;left:-220px;top:-260px;background:#3b6fe0}
  .g2{width:760px;height:760px;right:-230px;bottom:-280px;background:#8b5cf6}
  .frame{position:absolute;inset:0;padding:54px 84px;display:flex;flex-direction:column}
  .top{display:flex;align-items:center;gap:16px}
  .top img{width:50px;height:50px;border-radius:13px}
  .wm{font-size:27px;font-weight:800}
  .pill{margin-left:auto;font-size:15px;color:#9fb0d0;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:8px 16px}
  .pill b{color:#6ea2ff}
  h1{font-size:78px;line-height:.97;font-weight:800;letter-spacing:-3px;margin-top:12px}
  h1 .grad{background:linear-gradient(100deg,#6ea2ff,#a98bff);-webkit-background-clip:text;background-clip:text;color:transparent}
  .sub{font-size:21px;color:#cdd8f0;margin-top:9px}
  .rows{margin-top:24px;display:flex;flex-direction:column;gap:13px}
  .row{display:flex;align-items:center;gap:18px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:15px 22px}
  .ic{width:46px;height:46px;flex:0 0 46px;border-radius:12px;background:#0d1422;border:1.5px solid;font-weight:800;font-size:22px;display:flex;align-items:center;justify-content:center}
  .rh{font-size:23px;font-weight:700}
  .rd{font-size:16px;color:#aebbd6;margin-top:1px}
  .rc{font-size:13px;color:#7d92b6;font-family:ui-monospace,Menlo,Consolas,monospace;margin-top:3px}
  .foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;padding-top:16px;border-top:1px solid rgba(255,255,255,.08)}
  .foot .site{font-size:23px;font-weight:700;color:#cdd8f0}
  .foot .t{font-size:18px;color:#8aa0c8}.foot .t b{color:#a98bff}
</style></head><body>
  <div class="glow g1"></div><div class="glow g2"></div>
  <div class="frame">
    <div class="top"><img src="${logoUri}"><span class="wm">SIGNA</span><span class="pill">Base · onchain messaging — <b>all live, all verifiable</b></span></div>
    <h1>onchain messaging on <span class="grad">Base</span></h1>
    <div class="sub">public, paid, token-gated, and private — wallet-native, ownerless, readable by anyone and owned by no one.</div>
    <div class="rows">${rows}</div>
    <div class="foot"><span class="site">signaagent.xyz</span><span class="t">three ownerless contracts on Base — <b>the message layer, made real.</b></span></div>
  </div>
</body></html>`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const OUT = "C:/Users/Acer/OneDrive/Desktop/signa-onchain-suite.png";
await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1600, height: 900 } });
await browser.close();
for (const d of ["C:/Users/Acer/Desktop", "C:/Users/Acer/Downloads"]) { try { copyFileSync(OUT, `${d}/signa-onchain-suite.png`); } catch {} }
console.log("WROTE", OUT);
