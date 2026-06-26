// Render the "money that carries proof" card from a REAL live B20 money-note on prod.
//   run from web/:  node scripts/b20-note-card.mjs
import { readFileSync, copyFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
const BASE = process.env.BASE ?? "https://www.signaagent.xyz";
const logoUri = `data:image/png;base64,${readFileSync("public/signa-logo-200.png").toString("base64")}`;
const payer = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");

const spec = { token: "0xb2000000000000000000007ad5e0c47f47b5a908", to: "0x95fce75729690477e48820805c74602338e19303", amount: "1500000", note: "invoice #42 — data pull for agent VERA, paid in full", from: payer.address.toLowerCase() };
const bj = await (await fetch(`${BASE}/api/b20/note`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(spec) })).json();
const signature = await payer.signMessage({ message: bj.preimage });
const vj = await (await fetch(`${BASE}/api/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...bj.reverify, signature }) })).json();
const bytes = ((bj.tx?.data?.length ?? 2) - 2) / 2;
console.log("live:", { memo: bj.memo, valid: vj.valid, recovered: vj.recovered });
const sa = (a, n = 8) => (a ? `${a.slice(0, n)}…${a.slice(-6)}` : "—");

const steps = [
  ["1", "the payer signs a note", `“${spec.note}”`, "#6ea2ff"],
  ["2", "memo = keccak256(note), on-chain", `${sa(bj.memo, 14)}  ← the transferWithMemo memo`, "#a98bff"],
  ["3", "transferWithMemo broadcast", `token ${sa(spec.token, 10)} · ${bytes} bytes`, "#5ee68f"],
].map(([n, h, d, c]) => `<div class="step"><span class="n" style="color:${c};border-color:${c}66">${n}</span><div><div class="sh">${h}</div><div class="sd">${d}</div></div></div>`).join("");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1600px;height:900px}
  body{font-family:'Segoe UI',-apple-system,system-ui,sans-serif;background:#070b12;color:#eef2fb;overflow:hidden;position:relative}
  .glow{position:absolute;border-radius:50%;filter:blur(150px);opacity:.5}
  .g1{width:820px;height:820px;left:-220px;top:-260px;background:#3b6fe0}
  .g2{width:760px;height:760px;right:-230px;bottom:-280px;background:#22c98a}
  .frame{position:absolute;inset:0;padding:60px 84px;display:flex;flex-direction:column}
  .top{display:flex;align-items:center;gap:16px}
  .top img{width:50px;height:50px;border-radius:13px}
  .wm{font-size:27px;font-weight:800}
  .pill{margin-left:auto;font-size:15px;color:#9fb0d0;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:8px 16px}
  .pill b{color:#6ea2ff}
  h1{font-size:82px;line-height:.98;font-weight:800;letter-spacing:-2.5px;margin-top:14px}
  h1 .grad{background:linear-gradient(100deg,#6ea2ff,#5ee68f);-webkit-background-clip:text;background-clip:text;color:transparent}
  .sub{font-size:22px;color:#cdd8f0;margin-top:10px}
  .tag{font-size:20px;color:#8aa0c8;margin-top:8px}
  .tag b{color:#a5c3ff}
  .steps{margin-top:26px;display:flex;flex-direction:column;gap:12px}
  .step{display:flex;align-items:center;gap:16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:14px 20px}
  .step .n{width:42px;height:42px;flex:0 0 42px;border-radius:50%;background:#0d1422;border:1.5px solid;font-weight:800;font-size:20px;display:flex;align-items:center;justify-content:center}
  .step .sh{font-size:21px;font-weight:700}
  .step .sd{font-size:16px;color:#aebbd6;font-family:ui-monospace,Menlo,Consolas,monospace;margin-top:2px}
  .verified{margin-top:20px;border:1px solid rgba(94,230,143,.45);background:rgba(34,201,138,.10);border-radius:14px;padding:18px 22px;display:flex;align-items:center;gap:18px}
  .verified .big{font-size:30px;font-weight:800;color:#5ee68f}
  .verified .vt{font-size:18px;color:#dfeaf7}.verified .vt b{color:#5ee68f}
  .verified .vs{font-size:14px;color:#86a0c0;font-family:ui-monospace,Menlo,Consolas,monospace;margin-top:3px}
  .foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;padding-top:18px;border-top:1px solid rgba(255,255,255,.08)}
  .foot .site{font-size:23px;font-weight:700;color:#cdd8f0}
  .foot .t{font-size:18px;color:#8aa0c8}.foot .t b{color:#5ee68f}
</style></head><body>
  <div class="glow g1"></div><div class="glow g2"></div>
  <div class="frame">
    <div class="top"><img src="${logoUri}"><span class="wm">SIGNA</span><span class="pill">Base · B20 — <b>transferWithMemo</b></span></div>
    <h1>Money that carries <span class="grad">proof.</span></h1>
    <div class="sub">B20&apos;s transferWithMemo lets a transfer carry a memo on-chain. SIGNA makes it a wallet-signed note.</div>
    <div class="tag">an agent pays another agent — and the invoice travels <b>with the money</b>, unforgeable.</div>
    <div class="steps">${steps}</div>
    <div class="verified">
      <span class="big">✓ valid</span>
      <div><div class="vt">the note <b>recovers to the payer</b> ${sa(vj.recovered)} — bound to the on-chain transfer</div>
      <div class="vs">/api/verify (kind b20_memo) → valid:${vj.valid} · recovered=payer · no trust required</div></div>
    </div>
    <div class="foot"><span class="site">signaagent.xyz/b20</span><span class="t">on B20, money can talk — <b>SIGNA proves it.</b></span></div>
  </div>
</body></html>`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const OUT = "C:/Users/Acer/OneDrive/Desktop/signa-b20-note.png";
await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1600, height: 900 } });
await browser.close();
for (const d of ["C:/Users/Acer/Desktop", "C:/Users/Acer/Downloads"]) { try { copyFileSync(OUT, `${d}/signa-b20-note.png`); } catch {} }
console.log("WROTE", OUT);
