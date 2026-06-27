// Is B20 createB20 actually callable on Base mainnet right now? Simulate via eth_call (no gas).
import { createPublicClient, http, keccak256, toBytes, encodeAbiParameters, encodeFunctionData } from "viem";
import { base } from "viem/chains";

const FACTORY = "0xB20f000000000000000000000000000000000000";
const sender = "0x95fce75729690477e48820805c74602338e19303";
const ABI = [
  { type: "function", name: "createB20", stateMutability: "payable", inputs: [{ name: "variant", type: "uint8" }, { name: "salt", type: "bytes32" }, { name: "params", type: "bytes" }, { name: "initCalls", type: "bytes[]" }], outputs: [{ name: "token", type: "address" }] },
  { type: "function", name: "getB20Address", stateMutability: "view", inputs: [{ name: "variant", type: "uint8" }, { name: "sender", type: "address" }, { name: "salt", type: "bytes32" }], outputs: [{ name: "", type: "address" }] },
];
const ASSET = [{ type: "tuple", components: [{ name: "version", type: "uint8" }, { name: "name", type: "string" }, { name: "symbol", type: "string" }, { name: "initialAdmin", type: "address" }, { name: "decimals", type: "uint8" }] }];

for (const url of [process.env.BASE_RPC_URL, "https://mainnet.base.org", "https://base.llamarpc.com"].filter(Boolean)) {
  console.log(`\n=== RPC ${url} ===`);
  const c = createPublicClient({ chain: base, transport: http(url) });
  const salt = keccak256(toBytes("signa:b20:livecheck:1"));
  // 1) read: getB20Address
  try {
    const a = await c.readContract({ address: FACTORY, abi: ABI, functionName: "getB20Address", args: [0, sender, salt] });
    console.log("getB20Address (read):", a, "→ precompile responds to reads ✓");
  } catch (e) { console.log("getB20Address read FAILED:", String(e).slice(0, 120)); }
  // 2) code at factory
  try { const code = await c.getBytecode({ address: FACTORY }); console.log("factory bytecode:", code ? `${(code.length - 2) / 2} bytes` : "none (precompiles often have none)"); } catch {}
  // 3) simulate createB20 (eth_call — no gas, no broadcast)
  try {
    const params = encodeAbiParameters(ASSET, [{ version: 1, name: "Live Check", symbol: "LIVECHK", initialAdmin: sender, decimals: 18 }]);
    const data = encodeFunctionData({ abi: ABI, functionName: "createB20", args: [0, salt, params, []] });
    const r = await c.call({ to: FACTORY, data, account: sender });
    console.log("createB20 SIMULATION OK → launches appear LIVE. returned:", r?.data ?? r);
  } catch (e) {
    const msg = (e?.shortMessage || e?.details || String(e)).slice(0, 240);
    console.log("createB20 simulation reverted/failed →", msg);
  }
}
