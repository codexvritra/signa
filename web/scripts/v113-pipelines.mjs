/**
 * v2.4 — Signed Pipelines (live on prod, no mock).
 *
 * Runs a real multi-provider capability pipeline and INDEPENDENTLY re-verifies
 * the whole provenance chain with viem (not trusting the server's verdict):
 *
 *   step 0  root.feargreed   (provider: root-edge)  -> {score, label}
 *   step 1  token.price      (provider: signa/DefiLlama) -> {price_usd}
 *   step 2  signa.reason     composes {{0.label}} + {{1.price_usd}} -> one-line read
 *
 * Then locally: rebuild each link preimage, verifyMessage against the gateway,
 * confirm link.prev == sha256(prev signature), confirm root, and confirm each
 * output hash matches. Also flips a byte to prove tampering breaks the chain.
 *
 *   node scripts/v113-pipelines.mjs
 */
import { mkdirSync, writeFileSync, readdirSync, existsSync, unlinkSync, renameSync } from "node:fs";
import { resolve as presolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { verifyMessage } from "viem";

const BASE = process.env.SIGNA_BASE ?? "https://www.signaagent.xyz";
const OUT = "C:/Users/Acer/OneDrive/Desktop/signa-private/screenshots";
mkdirSync(OUT, { recursive: true });
const short = (a) => (a && a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);
let fails = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL ") + m); if (!c) fails++; };
const sha = (s) => createHash("sha256").update(s).digest("hex");
const hashJson = (v) => sha(JSON.stringify(v ?? null));
const GENESIS = "genesis";
const linkPreimage = (runId, l) => [
  "SIGNA pipeline link v1", `run:${runId}`, `step:${l.step}`, `cap:${l.cap}`,
  `provider:${l.provider.toLowerCase()}`, `input:${l.input_hash}`, `output:${l.output_hash}`, `prev:${l.prev}`, `ts:${l.ts}`,
].join("\n");

const STEPS = [
  { cap: "root.feargreed", arg: "" },
  { cap: "token.price", arg: "ethereum" },
  { cap: "signa.reason", arg: "Crypto fear and greed is {{0.label}} ({{0.score}}) and ETH is ${{1.price_usd}}. Give a one sentence read on the Base market. No advice." },
];

console.log(`SIGNA Signed Pipelines — run a multi-provider pipeline + re-verify the chain (live on ${BASE})\n`);

let run = {};
try {
  run = await (await fetch(`${BASE}/api/pipelines/run`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ steps: STEPS }) })).json();
} catch (e) { console.log("run error", String(e).slice(0, 120)); }

ok(run?.ok && run?.completed && (run.steps ?? []).length === 3, `RUN: 3-step pipeline completed (${(run.steps ?? []).length} steps)`);
const providers = (run.steps ?? []).map((s) => `${s.cap}:${s.provider === "root-edge" || s.provider === "signa" ? s.provider : short(s.provider)}`);
const distinctProviders = new Set((run.steps ?? []).map((s) => s.provider));
ok(distinctProviders.size >= 2, `MULTI-PROVIDER: steps span ${distinctProviders.size} providers — ${providers.join(", ")}`);
const answer = (() => { try { return run.steps[2].output.response; } catch { return null; } })();
ok(!!answer, `COMPOSE: step 2 reasoned over steps 0+1 — "${(answer ?? "").slice(0, 90)}"`);

// ── INDEPENDENT local re-verification (don't trust the server) ──
let prev = GENESIS, chainOk = true, sigOk = true, hashOk = true;
for (let i = 0; i < (run.chain ?? []).length; i++) {
  const l = run.chain[i];
  const pre = linkPreimage(run.runId, { step: l.step, cap: l.cap, provider: l.provider, input_hash: l.input_hash, output_hash: l.output_hash, prev: l.prev, ts: l.ts });
  let s = false;
  try { s = await verifyMessage({ address: run.gateway, message: pre, signature: l.signature }); } catch { s = false; }
  if (!s) sigOk = false;
  if (l.prev !== prev) chainOk = false;
  if (hashJson(run.steps[i].output) !== l.output_hash) hashOk = false;
  prev = sha(l.signature);
}
const rootOk = run.root === sha(run.chain[run.chain.length - 1].signature);
ok(sigOk, `VERIFY: every link signature re-verifies against the gateway ${short(run.gateway)} (EIP-191)`);
ok(chainOk, `VERIFY: hash-chain intact — each link.prev == sha256(previous signature)`);
ok(hashOk, `VERIFY: every step output hash matches its signed link`);
ok(rootOk, `VERIFY: chain root == sha256(last signature) — ${short(run.root)}`);

// ── tamper test: flip one output, the chain must fail ──
const tampered = JSON.parse(JSON.stringify(run));
tampered.steps[0].output = { score: 99, label: "extreme greed" }; // lie about step 0
let tamperCaught = false;
try {
  const vr = await (await fetch(`${BASE}/api/pipelines/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ runId: tampered.runId, chain: tampered.chain, steps: tampered.steps, root: tampered.root }) })).json();
  tamperCaught = vr?.valid === false;
} catch { /* */ }
ok(tamperCaught, `TAMPER: altering a step's output makes the chain fail verification (caught)`);

console.log(fails === 0
  ? "\n✓ signed pipelines verified live — multi-provider run, one wallet-signed provenance chain, re-verified independently, tampering caught"
  : `\n✗ ${fails} step(s) failed`);

// ─────────────── animated proof + video ───────────────
const allGreen = fails === 0;
const steps = [
  { k: "root.feargreed", c: "#9ad7ff", t: `provider root-edge → ${run?.steps?.[0]?.output ? `${run.steps[0].output.label} (${run.steps[0].output.score})` : "market read"}` },
  { k: "token.price", c: "#b7ff5c", t: `provider signa → ETH ≈ $${Math.round(run?.steps?.[1]?.output?.price_usd ?? 0) || "?"}` },
  { k: "signa.reason", c: "#7af0a8", t: `composes both → ${(answer ?? "one-line read").slice(0, 86)}` },
  { k: "proof", c: "#ffd84d", t: `one wallet-signed provenance chain · re-verified with viem · tampering breaks it · root ${short(run?.root ?? "")}` },
];
const data = JSON.stringify({ steps, allGreen });
const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
 :root{--bg:#06070b;--accent:#b7ff5c;--text:#e9ecf2;--muted:rgba(233,236,242,0.45)}
 *{box-sizing:border-box;margin:0;padding:0}
 html,body{background:var(--bg);color:var(--text);font-family:"JetBrains Mono",ui-monospace,monospace}
 .stage{width:1280px;height:720px;display:flex;flex-direction:column;padding:34px 50px;background:radial-gradient(ellipse 60% 45% at 50% 0%,rgba(183,255,92,0.09),transparent 70%),var(--bg)}
 .head{display:flex;align-items:baseline;justify-content:space-between}
 .brand{font-family:"Space Grotesk",sans-serif;font-size:25px;font-weight:600}.brand .a{color:var(--accent)}
 .tag{font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:var(--accent)}
 .sub{font-size:13.5px;color:var(--muted);margin:8px 0 22px;max-width:1010px;line-height:1.45}
 .flow{flex:1;display:flex;flex-direction:column;gap:13px;justify-content:center}
 .step{display:flex;align-items:flex-start;gap:18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:15px 20px;opacity:0;transform:translateX(-14px);transition:opacity .5s,transform .5s}
 .step.show{opacity:1;transform:translateX(0)}
 .k{font-size:12.5px;font-weight:700;letter-spacing:0.06em;min-width:150px}
 .t{flex:1;font-size:14px;color:rgba(245,245,250,0.9);line-height:1.4}
 .arrow{color:rgba(245,245,250,0.25);font-size:16px;padding-left:8px}
 .seal{margin-top:18px;display:flex;align-items:center;justify-content:space-between;opacity:0;transition:opacity .7s}.seal.show{opacity:1}
 .l{font-size:15px;color:var(--accent);font-weight:600} .r{font-size:13px;color:var(--muted)}.r b{color:var(--accent)}
</style></head><body>
<div class="stage">
 <div class="head"><div class="brand"><span class="a">signa</span> signed pipelines · compose providers, get one proof</div><div class="tag">provenance · keyless · base</div></div>
 <div class="sub">one run chains capabilities from different providers. every step's provider, input and output is hashed and signed, and each link is chained to the last — so the whole run emits one wallet-signed provenance chain anyone re-verifies with viem. provenance, not correctness. live on prod.</div>
 <div class="flow" id="flow"></div>
 <div class="seal" id="seal"><div class="l">✓ multi-provider run · one signed provenance chain · re-verified independently · tamper-evident</div><div class="r">signaagent.xyz/<b>pipelines</b></div></div>
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
const htmlPath = presolve("./scripts/v113-pipelines.html");
writeFileSync(htmlPath, html);
const tgt = `${OUT}/signa-v113-pipelines.webm`;
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
  await page.screenshot({ path: `${OUT}/signa-v113-pipelines-still.png` });
  await page.close(); await ctx.close(); await browser.close();
  const fresh = readdirSync(OUT).filter((f) => f.endsWith(".webm") && !before.has(f));
  if (fresh.length === 1) { renameSync(`${OUT}/${fresh[0]}`, tgt); console.log("saved", tgt); }
  console.log("still:", `${OUT}/signa-v113-pipelines-still.png`);
} catch (e) { console.log("playwright unavailable:", e.message); }
process.exit(fails > 0 ? 1 : 0);
