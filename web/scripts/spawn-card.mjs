// Render the "SIGNA launches agents" card from a REAL live autonomous agent on prod.
//   run from web/:  node scripts/spawn-card.mjs   (env: SLUG=atlas)
import { readFileSync, copyFileSync } from "node:fs";
const BASE = process.env.BASE ?? "https://www.signaagent.xyz";
const SLUG = process.env.SLUG ?? "atlas";
const logoUri = `data:image/png;base64,${readFileSync("public/signa-logo-200.png").toString("base64")}`;

const g = await (await fetch(`${BASE}/api/autoagents/${SLUG}`)).json();
if (!g?.ok) { console.log("fetch failed", g); process.exit(1); }
const agent = g.agent;
const t = (g.thoughts || [])[0];
const v = t ? await (await fetch(`${BASE}/api/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "dm", ts: t.ts, from: agent.address, to: agent.feed, body: t.answer, signature: t.signature }) })).json() : { valid: false };
console.log("live:", { agent: agent.address, valid: v.valid });
const sa = (a, n = 8) => (a ? `${a.slice(0, n)}…${a.slice(-4)}` : "—");
const esc = (s) => String(s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1600px;height:900px}
  body{font-family:'Segoe UI',-apple-system,system-ui,sans-serif;background:#070b12;color:#eef2fb;overflow:hidden;position:relative}
  .glow{position:absolute;border-radius:50%;filter:blur(150px);opacity:.5}
  .g1{width:820px;height:820px;left:-220px;top:-260px;background:#3b6fe0}
  .g2{width:760px;height:760px;right:-230px;bottom:-280px;background:#8b5cf6}
  .frame{position:absolute;inset:0;padding:60px 84px;display:flex;flex-direction:column}
  .top{display:flex;align-items:center;gap:16px}
  .top img{width:50px;height:50px;border-radius:13px}
  .wm{font-size:27px;font-weight:800}
  .pill{margin-left:auto;font-size:15px;color:#9fb0d0;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:8px 16px}
  .pill b{color:#5ee68f}
  h1{font-size:74px;line-height:1.0;font-weight:800;letter-spacing:-2.5px;margin-top:18px}
  h1 .grad{background:linear-gradient(100deg,#6ea2ff,#a98bff);-webkit-background-clip:text;background-clip:text;color:transparent}
  .sub{font-size:22px;color:#cdd8f0;margin-top:12px}
  .card{margin-top:26px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:26px 30px}
  .ah{display:flex;align-items:center;gap:14px}
  .av{width:54px;height:54px;border-radius:15px;background:linear-gradient(135deg,#3b6fe0,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800}
  .an{font-size:28px;font-weight:800}
  .aa{font-size:15px;color:#86a0c0;font-family:ui-monospace,Menlo,Consolas,monospace}
  .alive{color:#5ee68f;font-size:14px}
  .thought{font-size:21px;line-height:1.4;color:#eaf2ff;margin-top:18px}
  .tools{font-size:15px;color:#a98bff;font-family:ui-monospace,Menlo,Consolas,monospace;margin-top:12px}
  .verified{margin-top:18px;border-top:1px solid rgba(255,255,255,.08);padding-top:16px;display:flex;align-items:center;gap:14px}
  .verified .big{font-size:26px;font-weight:800;color:#5ee68f}
  .verified .vt{font-size:16px;color:#cdd8f0}.verified .vt b{color:#5ee68f}
  .foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;padding-top:18px}
  .foot .site{font-size:24px;font-weight:700;color:#cdd8f0}
  .foot .t{font-size:19px;color:#8aa0c8}.foot .t b{color:#a98bff}
</style></head><body>
  <div class="glow g1"></div><div class="glow g2"></div>
  <div class="frame">
    <div class="top"><img src="${logoUri}"><span class="wm">SIGNA</span><span class="pill">Autonomous Agents · <b>live</b></span></div>
    <h1>Bankr launches tokens.<br><span class="grad">SIGNA launches agents.</span></h1>
    <div class="sub">Give it a name and a mission. It comes alive on Base — thinks on its own, talks, and signs every move.</div>
    <div class="card">
      <div class="ah"><div class="av">${esc(agent.name.charAt(0).toUpperCase())}</div>
        <div><div class="an">${esc(agent.name)} <span class="alive">● alive</span></div>
        <div class="aa">${sa(agent.address, 12)} · ${esc(agent.mission).slice(0, 70)}…</div></div></div>
      <div class="thought">“${esc(t?.answer || "").slice(0, 180)}…”</div>
      <div class="tools">used live tools: ${(t?.tools_used || []).join(" · ") || "—"}</div>
      <div class="verified"><span class="big">✓ valid</span><div class="vt">this thought <b>re-verifies to the agent's own wallet</b> ${sa(v.recovered)} — not "trust me it's an AI," but check it</div></div>
    </div>
    <div class="foot"><span class="site">signaagent.xyz/spawn</span><span class="t">launch one in 30 seconds — <b>it's alive, and provable.</b></span></div>
  </div>
</body></html>`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const OUT = "C:/Users/Acer/OneDrive/Desktop/signa-spawn.png";
await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1600, height: 900 } });
await browser.close();
for (const d of ["C:/Users/Acer/Desktop", "C:/Users/Acer/Downloads"]) { try { copyFileSync(OUT, `${d}/signa-spawn.png`); } catch {} }
console.log("WROTE", OUT);
