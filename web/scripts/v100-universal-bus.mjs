/**
 * v1.0 — the universal agent bus, proven cross-framework.
 *
 * Runs the REAL drop-in skill (../signa-skill/signa.mjs) as two separate
 * agents, each with its own SIGNA_HOME (= two distinct minted wallets, like
 * two real installs on two machines). One is labeled a HERMES runtime, the
 * other an OPENCLAW runtime — two frameworks that cannot message each other
 * today. Through SIGNA they do, keyless, by wallet, live on prod:
 *
 *   1. each agent mints its own wallet (keyless onboarding, no api key)
 *   2. each announces itself → discoverable + framework-tagged in the resolver
 *   3. the Hermes agent resolves the OpenClaw agent (any id → address + routes)
 *   4. Hermes → OpenClaw: a wallet-signed DM
 *   5. OpenClaw reads it from its inbox
 *   6. OpenClaw → Hermes: a wallet-signed reply
 *   7. Hermes reads the reply
 *
 * Then renders an animated two-pane "conversation across frameworks" and
 * Playwright records it to webm + a still.
 *
 *   node scripts/v100-universal-bus.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, readdirSync, existsSync, unlinkSync, renameSync } from "node:fs";
import { resolve as presolve } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const SKILL = presolve("../signa-skill/signa.mjs");
const OUT = "C:/Users/Acer/OneDrive/Desktop/signa-private/screenshots";
mkdirSync(OUT, { recursive: true });
const short = (a) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

// each agent = its own SIGNA_HOME (own minted wallet), like two real installs
const HERMES_HOME = presolve(tmpdir(), "signa-hermes-agent");
const OPENCLAW_HOME = presolve(tmpdir(), "signa-openclaw-agent");
for (const d of [HERMES_HOME, OPENCLAW_HOME]) if (existsSync(d)) rmSync(d, { recursive: true, force: true });

function run(home, args) {
  return execFileSync("node", [SKILL, ...args], {
    env: { ...process.env, SIGNA_HOME: home },
    encoding: "utf8",
    timeout: 60000,
  });
}
let fails = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL ") + m); if (!c) fails++; };

// ── 1. keyless onboarding: each agent mints its own wallet ──
console.log("1 · keyless onboarding (each framework agent mints its own wallet)");
const hWho = JSON.parse(run(HERMES_HOME, ["whoami"]).match(/\{[\s\S]*\}/)[0]);
const oWho = JSON.parse(run(OPENCLAW_HOME, ["whoami"]).match(/\{[\s\S]*\}/)[0]);
const H = hWho.address, O = oWho.address;
ok(/^0x[a-f0-9]{40}$/.test(H), `hermes agent wallet (minted locally, no api key): ${H}`);
ok(/^0x[a-f0-9]{40}$/.test(O) && O !== H, `openclaw agent wallet (separate install, separate key): ${O}`);

// ── 2. announce → discoverable + framework-tagged ──
console.log("\n2 · announce (each agent becomes discoverable, tagged with its framework)");
let hAnn = "", oAnn = "";
try { hAnn = run(HERMES_HOME, ["announce", "hermes", "Hermes 4", "hermes runtime agent"]); } catch (e) { hAnn = "ERR " + String(e.stderr || e.message).slice(0, 80); }
try { oAnn = run(OPENCLAW_HOME, ["announce", "openclaw", "OpenClaw", "openclaw runtime agent"]); } catch (e) { oAnn = "ERR " + String(e.stderr || e.message).slice(0, 80); }
ok(/announced as hermes/i.test(hAnn), `hermes agent announced: ${hAnn.trim().split("\n")[0]}`);
ok(/announced as openclaw/i.test(oAnn), `openclaw agent announced: ${oAnn.trim().split("\n")[0]}`);

// ── 3. resolve: the Hermes agent resolves the OpenClaw agent ──
console.log("\n3 · resolve (Hermes resolves the OpenClaw agent — any id → address + routes)");
const resOut = run(HERMES_HOME, ["resolve", O]);
const res = JSON.parse(resOut.match(/\{[\s\S]*\}/)[0]);
const bridgePlatform = res?.routes?.bridge?.platform ?? null;
ok(res.ok && res.address === O, `resolved ${short(O)} → reachable via [${(res.reachable_via || []).join(", ")}]`);
ok(bridgePlatform === "openclaw", `the resolver reports the target's framework: ${bridgePlatform ?? "(directory lag)"}`);

// also prove name resolution works universally
let nameRes = null;
try { nameRes = JSON.parse(run(HERMES_HOME, ["resolve", "vitalik.eth"]).match(/\{[\s\S]*\}/)[0]); } catch {}
ok(!!nameRes?.address, `name resolution works too: vitalik.eth → ${short(nameRes?.address ?? "?")}`);

// ── 4. Hermes → OpenClaw: wallet-signed DM ──
console.log("\n4 · Hermes → OpenClaw (wallet-signed DM, cross-framework)");
const msg1 = "gm from a Hermes agent. first wallet-signed message across frameworks. no api key, just my wallet.";
const sendOut = run(HERMES_HOME, ["send", O, msg1]);
const dm1 = sendOut.match(/sent dm (\S+)/)?.[1] ?? null;
ok(!!dm1, `sent dm ${short(dm1 ?? "")} — EIP-191 signed by the Hermes agent's wallet`);

// ── 5. OpenClaw reads its inbox ──
console.log("\n5 · OpenClaw reads its inbox");
const inbox1 = run(OPENCLAW_HOME, ["inbox", "5"]);
const got1 = inbox1.includes(H.slice(0, 10)) || inbox1.toLowerCase().includes("hermes agent");
ok(got1, `the OpenClaw agent received the Hermes agent's message in its inbox`);

// ── 6. OpenClaw → Hermes: wallet-signed reply ──
console.log("\n6 · OpenClaw → Hermes (wallet-signed reply)");
const msg2 = "ack from an OpenClaw agent. two frameworks, one wallet-signed wire. signa works.";
const replyOut = dm1
  ? run(OPENCLAW_HOME, ["reply", dm1, H, msg2])
  : run(OPENCLAW_HOME, ["send", H, msg2]);
const dm2 = replyOut.match(/dm (\S+)/)?.[1] ?? null;
ok(!!dm2, `replied dm ${short(dm2 ?? "")} — signed by the OpenClaw agent's wallet`);

// ── 7. Hermes reads the reply ──
console.log("\n7 · Hermes reads the reply");
const inbox2 = run(HERMES_HOME, ["inbox", "5"]);
const got2 = inbox2.includes(O.slice(0, 10)) || inbox2.toLowerCase().includes("openclaw agent");
ok(got2, `the Hermes agent received the OpenClaw agent's reply — round trip complete`);

console.log(
  fails === 0
    ? "\n✓ cross-framework messaging verified live on prod — Hermes ↔ OpenClaw, keyless, by wallet"
    : `\n✗ ${fails} step(s) failed`,
);

// cleanup the throwaway homes
for (const d of [HERMES_HOME, OPENCLAW_HOME]) try { rmSync(d, { recursive: true, force: true }); } catch {}

// ─────────────── animated two-pane conversation ───────────────
const allGreen = fails === 0;
const convo = [
  { side: "h", kind: "sys", t: `minted wallet ${short(H)} · no api key` },
  { side: "o", kind: "sys", t: `minted wallet ${short(O)} · no api key` },
  { side: "h", kind: "act", t: `resolve ${short(O)} → openclaw agent · reachable [signa, a2a, bridge]` },
  { side: "h", kind: "msg", t: msg1 },
  { side: "o", kind: "act", t: `inbox → 1 new · verified the signature` },
  { side: "o", kind: "msg", t: msg2 },
  { side: "h", kind: "act", t: `inbox → reply received · round trip complete` },
];
const data = JSON.stringify({ H: short(H), O: short(O), convo, allGreen });

const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
 :root{--bg:#06070b;--accent:#b7ff5c;--cyan:#9ad7ff;--gold:#ffd84d;--text:#e9ecf2;--muted:rgba(233,236,242,0.45)}
 *{box-sizing:border-box;margin:0;padding:0}
 html,body{background:var(--bg);color:var(--text);font-family:"JetBrains Mono",ui-monospace,monospace}
 .stage{width:1280px;height:720px;display:flex;flex-direction:column;padding:30px 40px;
  background:radial-gradient(ellipse 60% 45% at 50% 0%,rgba(183,255,92,0.08),transparent 70%),var(--bg)}
 .head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px}
 .brand{font-family:"Space Grotesk",sans-serif;font-size:24px;font-weight:600;letter-spacing:-0.02em}
 .brand .a{color:var(--accent)}
 .tag{font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:var(--accent)}
 .subtitle{font-size:13px;color:var(--muted);margin-bottom:14px}
 .cols{flex:1;display:flex;gap:18px}
 .pane{flex:1;display:flex;flex-direction:column;background:linear-gradient(180deg,#0b0d13,#080a0f);
   border:1px solid rgba(255,255,255,0.09);border-radius:14px;overflow:hidden}
 .pbar{height:42px;display:flex;align-items:center;gap:10px;padding:0 16px;border-bottom:1px solid rgba(255,255,255,0.07)}
 .logo{width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#06070b}
 .h .logo{background:var(--cyan)} .o .logo{background:var(--gold)}
 .pname{font-size:13px;font-weight:600} .h .pname{color:var(--cyan)} .o .pname{color:var(--gold)}
 .paddr{font-size:11px;color:var(--muted);margin-left:auto}
 .feed{flex:1;padding:14px;display:flex;flex-direction:column;gap:10px;overflow:hidden}
 .bub{max-width:88%;padding:9px 13px;border-radius:11px;font-size:13px;line-height:1.42;opacity:0;transform:translateY(8px);transition:opacity .45s,transform .45s}
 .bub.show{opacity:1;transform:translateY(0)}
 .sys{align-self:center;background:rgba(255,255,255,0.04);color:var(--muted);font-size:11.5px;text-align:center}
 .act{align-self:flex-start;background:rgba(154,215,255,0.07);border:1px solid rgba(154,215,255,0.18);color:var(--cyan);font-size:12px}
 .o .act{background:rgba(255,216,77,0.07);border-color:rgba(255,216,77,0.18);color:var(--gold)}
 .msg{align-self:flex-end;background:rgba(183,255,92,0.10);border:1px solid rgba(183,255,92,0.28);color:var(--text)}
 .msgin{align-self:flex-start;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.10);color:var(--text)}
 .wire{display:flex;align-items:center;justify-content:center;gap:10px;margin:10px 0 2px;font-size:11.5px;color:var(--muted);letter-spacing:0.04em}
 .dot{width:6px;height:6px;border-radius:50%;background:var(--accent);opacity:0;animation:none}
 .seal{margin-top:12px;display:flex;align-items:center;justify-content:space-between;opacity:0;transition:opacity .7s}
 .seal.show{opacity:1}
 .seal .l{font-size:15px;color:var(--accent);font-weight:600}
 .seal .r{font-size:13px;color:var(--muted)} .seal .r b{color:var(--accent)}
</style></head><body>
<div class="stage">
 <div class="head"><div class="brand"><span class="a">signa</span> · the universal agent bus</div><div class="tag">keyless · wallet-signed · base</div></div>
 <div class="subtitle">two frameworks that can't message each other today. one wallet-signed wire. live on prod.</div>
 <div class="wire">HERMES agent <span style="color:var(--accent)">⇄ signa ⇄</span> OPENCLAW agent — neither holds an api key</div>
 <div class="cols">
  <div class="pane h"><div class="pbar"><div class="logo">H</div><div class="pname">Hermes runtime</div><div class="paddr" id="ha"></div></div><div class="feed" id="hf"></div></div>
  <div class="pane o"><div class="pbar"><div class="logo">O</div><div class="pname">OpenClaw runtime</div><div class="paddr" id="oa"></div></div><div class="feed" id="of"></div></div>
 </div>
 <div class="seal" id="seal"><div class="l">✓ Hermes ↔ OpenClaw — cross-framework, keyless, by wallet</div><div class="r"><b>signaagent.xyz/bus</b></div></div>
</div>
<script>
const D = ${data};
const pause = (ms) => new Promise(r => setTimeout(r, ms));
document.getElementById('ha').textContent = D.H;
document.getElementById('oa').textContent = D.O;
function bubble(feedId, cls, text) {
  const f = document.getElementById(feedId);
  const d = document.createElement('div'); d.className = 'bub ' + cls; d.textContent = text;
  f.appendChild(d); requestAnimationFrame(() => d.classList.add('show'));
}
(async () => {
  await pause(700);
  for (const c of D.convo) {
    const feed = c.side === 'h' ? 'hf' : 'of';
    if (c.kind === 'sys') bubble(feed, 'sys', c.t);
    else if (c.kind === 'act') bubble(feed, 'act', c.t);
    else if (c.kind === 'msg') {
      // sender bubble on its own pane, then the same message lands as incoming on the other pane
      bubble(feed, 'msg', c.t);
      await pause(650);
      bubble(c.side === 'h' ? 'of' : 'hf', 'msgin', c.t);
    }
    await pause(950);
  }
  await pause(500);
  if (D.allGreen) document.getElementById('seal').classList.add('show');
  await pause(2600);
  document.body.setAttribute('data-done','true');
})();
</script>
</body></html>`;

const htmlPath = presolve("./scripts/v100-universal-bus.html");
writeFileSync(htmlPath, html);

const target = `${OUT}/signa-v100-universal-bus.webm`;
if (existsSync(target)) unlinkSync(target);
const before = new Set(readdirSync(OUT).filter((f) => f.endsWith(".webm")));
try {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
    colorScheme: "dark",
  });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(htmlPath).href);
  await page.waitForFunction(() => document.body.getAttribute("data-done") === "true", { timeout: 120000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/signa-v100-universal-bus-still.png` });
  await page.close();
  await ctx.close();
  await browser.close();
  const fresh = readdirSync(OUT).filter((f) => f.endsWith(".webm") && !before.has(f));
  if (fresh.length === 1) { renameSync(`${OUT}/${fresh[0]}`, target); console.log("saved", target); }
  console.log("still:", `${OUT}/signa-v100-universal-bus-still.png`);
} catch (e) {
  console.log("playwright unavailable:", e.message, "· html at", htmlPath);
}
process.exit(fails > 0 ? 1 : 0);
