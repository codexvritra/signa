/**
 * Verify the v0.7.0 capability-gateway tools over real MCP stdio JSON-RPC,
 * the same way Claude Desktop / Cursor / Windsurf drive the server. Hits prod
 * SIGNA for the live data. Proves: tools/list exposes the gateway tools, and
 * signa_capabilities + signa_invoke + signa_brain return real results.
 */
import { spawn } from "node:child_process";
import { generatePrivateKey } from "viem/accounts";

const proc = spawn("node", ["dist/index.js"], {
  cwd: process.cwd(),
  env: { ...process.env, SIGNA_PRIVATE_KEY: generatePrivateKey() },
  stdio: ["pipe", "pipe", "pipe"],
});

let buf = "";
let nextId = 1;
const pending = new Map();
proc.stdout.on("data", (chunk) => {
  buf += chunk.toString();
  let nl;
  while ((nl = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id != null && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    } catch { /* ignore non-json */ }
  }
});
proc.stderr.on("data", () => {});
const call = (method, params) => new Promise((resolve) => {
  const id = nextId++;
  pending.set(id, resolve);
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
});

let fails = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ FAIL ") + m); if (!c) fails++; };

async function main() {
  await call("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "gateway-test", version: "1" } });
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  const list = await call("tools/list", {});
  const names = (list.result?.tools ?? []).map((t) => t.name);
  const need = ["signa_capabilities", "signa_invoke", "signa_publish", "signa_brain"];
  ok(need.every((n) => names.includes(n)), `tools/list exposes the gateway tools (${names.length} total): ${need.join(", ")}`);

  const caps = await call("tools/call", { name: "signa_capabilities", arguments: {} });
  const capsText = caps.result?.content?.[0]?.text ?? "";
  ok(/marketplace/i.test(capsText) && /built-in/i.test(capsText), `signa_capabilities returns the live directory`);
  console.log("    " + capsText.split("\n").slice(0, 3).join("\n    "));

  const inv = await call("tools/call", { name: "signa_invoke", arguments: { cap: "bankr.launches" } });
  const invText = inv.result?.content?.[0]?.text ?? "";
  ok(/signed by gateway 0x/i.test(invText), `signa_invoke returns a wallet-signed result`);

  const brain = await call("tools/call", { name: "signa_brain", arguments: { goal: "in one sentence, what is the base market doing right now" } });
  const brainText = brain.result?.content?.[0]?.text ?? "";
  ok(/signed by: brain 0x/i.test(brainText), `signa_brain answers and signs a receipt`);
  console.log("    " + brainText.split("\n").slice(0, 4).join("\n    "));

  console.log(fails === 0 ? "\n[OK] capability gateway verified over MCP stdio — the whole mesh through one server." : `\n[FAIL] ${fails} check(s) failed`);
  proc.kill();
  process.exit(fails > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); proc.kill(); process.exit(1); });
setTimeout(() => { console.error("[timeout]"); proc.kill(); process.exit(1); }, 90_000);
