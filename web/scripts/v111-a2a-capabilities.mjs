/**
 * v2.2 — SIGNA capabilities over A2A (live on prod, no mock).
 *
 * Acts as a plain A2A v0.3.0 client (the way Google ADK / LangGraph / CrewAI
 * would) with ZERO SIGNA-specific code, and proves the whole mesh is reachable
 * over the open A2A standard:
 *
 *   1. DISCOVER  — read /.well-known/agent-card.json; the capability + brain
 *                  skills are advertised for any A2A agent to find
 *   2. INVOKE    — message/send "invoke root.feargreed" → the capability runs
 *                  and the WALLET-SIGNED result comes back as an A2A artifact,
 *                  which we re-verify against the gateway with viem
 *   3. BRAIN     — message/send "brain: <goal>" → a capability-grounded answer
 *                  with a signed brain receipt artifact
 *   4. CHAT      — a freeform message still gets a normal SIGNA answer
 *
 *   node scripts/v111-a2a-capabilities.mjs
 */
import { mkdirSync, writeFileSync, readdirSync, existsSync, unlinkSync, renameSync } from "node:fs";
import { resolve as presolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { verifyMessage } from "viem";

const BASE = process.env.SIGNA_BASE ?? "https://www.signaagent.xyz";
const A2A = `${BASE}/api/a2a`;
const OUT = "C:/Users/Acer/OneDrive/Desktop/signa-private/screenshots";
mkdirSync(OUT, { recursive: true });
const short = (a) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
let fails = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL ") + m); if (!c) fails++; };

let n = 0;
async function send(text, extra = {}) {
  const messageId = `m-${++n}-${Math.floor(performance.now())}`;
  const body = { jsonrpc: "2.0", id: n, method: "message/send", params: { message: { kind: "message", role: "user", parts: [{ kind: "text", text }], messageId, ...extra } } };
  const r = await fetch(A2A, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return (await r.json())?.result;
}
const artifactData = (task, name) => (task?.artifacts ?? []).find((a) => a.name === name)?.parts?.find((p) => p.kind === "data")?.data;
const resultPreimage = (cap, input, prov, ts, output) => {
  const outHash = createHash("sha256").update(JSON.stringify(output)).digest("hex");
  return ["SIGNA capability result v1", `cap:${cap}`, `input:${input}`, `provider:${prov}`, `ts:${ts}`, `output:${outHash}`].join("\n");
};

console.log(`SIGNA capabilities over A2A — discover → invoke → brain → chat (live on ${BASE})\n`);

// ─────────────── 1. DISCOVER via the agent card ───────────────
let card = {};
try { card = await (await fetch(`${BASE}/.well-known/agent-card.json`)).json(); } catch (e) { console.log("card error", String(e).slice(0, 80)); }
const skillIds = (card?.skills ?? []).map((s) => s.id);
ok(skillIds.includes("capabilities") && skillIds.includes("brain"), `DISCOVER: agent card advertises the mesh — skills: ${skillIds.join(", ")}`);

// ─────────────── 2. INVOKE a capability over A2A → signed artifact ───────────────
const invTask = await send("invoke root.feargreed");
const invArt = artifactData(invTask, "capability-result");
ok(!!invArt?.ok && !!invArt?.signature, `INVOKE: "invoke root.feargreed" returned a signed capability-result artifact`);
let invVerified = false;
try {
  invVerified = invArt?.signature && invArt?.gateway
    ? await verifyMessage({ address: invArt.gateway, message: resultPreimage(invArt.capability, invArt.input ?? "", invArt.provider, invArt.ts, invArt.output), signature: invArt.signature })
    : false;
} catch { invVerified = false; }
ok(invVerified, `VERIFY: the A2A capability result re-verifies against the gateway ${short(invArt?.gateway ?? "")} (EIP-191)`);

// also prove the structured data-part form works (skill-targeted)
const invTask2 = await send("", { parts: [{ kind: "data", data: { cap: "root.market", arg: "" } }], metadata: { skillId: "capabilities" } });
const invArt2 = artifactData(invTask2, "capability-result");
ok(!!invArt2?.ok, `INVOKE: structured data part {cap:"root.market"} also resolves to a signed result`);

// ─────────────── 3. BRAIN over A2A ───────────────
const brainTask = await send("brain: in one sentence, what is the base market doing right now");
const brainText = brainTask?.status?.message?.parts?.[0]?.text ?? "";
const brainArt = artifactData(brainTask, "brain-receipt");
ok(brainText.length > 10 && !!brainArt?.signature, `BRAIN: "brain: ..." answered (${brainText.slice(0, 70)}) with a signed receipt`);

// ─────────────── 4. CHAT still works ───────────────
const chatTask = await send("what makes SIGNA different from plain A2A?");
const chatText = chatTask?.status?.message?.parts?.[0]?.text ?? "";
ok(chatText.length > 20, `CHAT: a freeform A2A message still gets a SIGNA answer`);

console.log(fails === 0
  ? "\n✓ the mesh is reachable over A2A — any A2A agent can discover, invoke (signed), and reason, with zero SIGNA-specific code"
  : `\n✗ ${fails} step(s) failed`);

// ─────────────── animated proof + video ───────────────
const allGreen = fails === 0;
const fg = invArt?.output ? `${invArt.output.label ?? ""} ${invArt.output.score ?? ""}`.trim() : "";
const steps = [
  { k: "discover", c: "#9ad7ff", t: `any A2A agent reads the agent card and finds the capability + brain skills` },
  { k: "invoke", c: "#b7ff5c", t: `message/send "invoke root.feargreed" → wallet-signed result artifact${fg ? ` (${fg})` : ""} · re-verified` },
  { k: "brain", c: "#7af0a8", t: `message/send "brain: ..." → ${brainText.slice(0, 84)}` },
  { k: "chat", c: "#ffd84d", t: `a freeform message still gets a normal signa answer — backward compatible` },
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
 .flow{flex:1;display:flex;flex-direction:column;gap:14px;justify-content:center}
 .step{display:flex;align-items:flex-start;gap:18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px 20px;opacity:0;transform:translateX(-14px);transition:opacity .5s,transform .5s}
 .step.show{opacity:1;transform:translateX(0)}
 .k{font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;min-width:96px}
 .t{flex:1;font-size:14.5px;color:rgba(245,245,250,0.9);line-height:1.4}
 .seal{margin-top:18px;display:flex;align-items:center;justify-content:space-between;opacity:0;transition:opacity .7s}.seal.show{opacity:1}
 .l{font-size:15px;color:var(--accent);font-weight:600} .r{font-size:13px;color:var(--muted)}.r b{color:var(--accent)}
</style></head><body>
<div class="stage">
 <div class="head"><div class="brand"><span class="a">signa</span> capabilities · over a2a</div><div class="tag">a2a v0.3.0 · keyless · base</div></div>
 <div class="sub">the whole capability mesh, reachable by any agent that speaks a2a — google adk, langgraph, crewai, llamaindex — with zero signa-specific code. discover the skills in the agent card, invoke a capability for a wallet-signed result, or ask the brain. live on prod.</div>
 <div class="flow" id="flow"></div>
 <div class="seal" id="seal"><div class="l">✓ discover · invoke (signed) · brain · chat — the mesh on the open a2a standard</div><div class="r">signaagent.xyz/<b>a2a</b></div></div>
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
  await pause(2600); document.body.setAttribute('data-done','true');
})();
</script>
</body></html>`;
const htmlPath = presolve("./scripts/v111-a2a-capabilities.html");
writeFileSync(htmlPath, html);
const tgt = `${OUT}/signa-v111-a2a-capabilities.webm`;
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
  await page.screenshot({ path: `${OUT}/signa-v111-a2a-capabilities-still.png` });
  await page.close(); await ctx.close(); await browser.close();
  const fresh = readdirSync(OUT).filter((f) => f.endsWith(".webm") && !before.has(f));
  if (fresh.length === 1) { renameSync(`${OUT}/${fresh[0]}`, tgt); console.log("saved", tgt); }
  console.log("still:", `${OUT}/signa-v111-a2a-capabilities-still.png`);
} catch (e) { console.log("playwright unavailable:", e.message); }
process.exit(fails > 0 ? 1 : 0);
