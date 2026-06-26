// Live prod check for the Agent Launchpad: spawn an autonomous agent, confirm its first
// signed thought re-verifies, then talk to it and verify the signed reply.
const BASE = process.env.BASE ?? "https://www.signaagent.xyz";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const creator = "0x95fce75729690477e48820805c74602338e19303";
const body = { name: "Atlas", mission: "Track Base liquidity and flag the single best opportunity every cycle, with a live number.", persona: "sharp, contrarian, no fluff", creator };

// poll the create endpoint until deployed (JSON, not 404 HTML); handle "taken" by reusing
let j = null, slug = "atlas";
for (let i = 0; i < 40; i++) {
  try {
    const r = await fetch(`${BASE}/api/autoagents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if ((r.headers.get("content-type") || "").includes("application/json")) {
      j = await r.json();
      if (j?.ok || /taken/.test(j?.error || "")) break;
    }
  } catch {}
  process.stdout.write(`. (${i})`); await sleep(8000);
}
console.log("");

let agentAddr, feed, thought;
if (j?.ok) {
  console.log(`✅ spawned ${j.agent.name} → ${j.agent.address}`);
  agentAddr = j.agent.address; thought = j.thought; feed = j.reverify?.to;
} else {
  // already exists — fetch it
  const g = await (await fetch(`${BASE}/api/autoagents/${slug}`)).json();
  if (!g?.ok) { console.log("could not create or fetch:", j, g); process.exit(1); }
  console.log(`(reusing existing ${g.agent.name} → ${g.agent.address})`);
  agentAddr = g.agent.address; feed = g.agent.feed; thought = (g.thoughts || [])[0];
}

if (thought) {
  console.log(`\nfirst autonomous thought:\n  "${(thought.answer || "").slice(0, 160)}…"`);
  console.log(`  tools: ${(thought.tools_used || []).join(", ") || "—"}`);
  const v = await (await fetch(`${BASE}/api/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "dm", ts: thought.ts, from: agentAddr, to: feed, body: thought.answer, signature: thought.signature }) })).json();
  console.log(`  verify thought: valid=${v.valid} recovers=${v.recovered} (agent=${agentAddr})`);
}

// talk to it
const cr = await (await fetch(`${BASE}/api/autoagents/${slug}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "chat", message: "in one line — bullish or bearish on Base right now, and why?" }) })).json();
console.log(`\nchat → "${(cr.answer || "").slice(0, 160)}…"`);
const cv = await (await fetch(`${BASE}/api/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cr.reverify) })).json();
console.log(`  verify reply: valid=${cv.valid} recovers=${cv.recovered}`);

const ok = cv.valid === true && cv.recovered === agentAddr.toLowerCase();
console.log(ok ? "\n✅ LIVE ON PROD — a spawned agent thinks, signs, talks, and re-verifies to itself" : "\n❌ did not pass");
process.exit(ok ? 0 : 1);
