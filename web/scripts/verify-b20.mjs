// Offline proof of the B20 launch-receipt loop: build calldata, sign the receipt,
// recover the signer — no gas, no server. Mirrors web/lib/b20.ts + verify-artifact.ts.
//   run from web/:  node scripts/verify-b20.mjs
import { keccak256, toBytes, encodeAbiParameters, encodeFunctionData, recoverMessageAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createHash } from "node:crypto";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const attestor = privateKeyToAccount(keccak256(toBytes("signa:b20-launch:v1")));

const FACTORY_ABI = [
  { type: "function", name: "createB20", stateMutability: "payable",
    inputs: [{ name: "variant", type: "uint8" }, { name: "salt", type: "bytes32" }, { name: "params", type: "bytes" }, { name: "initCalls", type: "bytes[]" }],
    outputs: [{ name: "token", type: "address" }] },
];
const ASSET_PARAMS = [{ type: "tuple", components: [
  { name: "version", type: "uint8" }, { name: "name", type: "string" }, { name: "symbol", type: "string" },
  { name: "initialAdmin", type: "address" }, { name: "decimals", type: "uint8" }] }];

const creator = "0x95fce75729690477e48820805c74602338e19303";
const ts = 1750000000000, name = "Signa Agent Token", symbol = "SAT", decimals = 18;
const salt = keccak256(toBytes(`signa:b20:${creator.toLowerCase()}:${symbol}:${ts}`));
const params = encodeAbiParameters(ASSET_PARAMS, [{ version: 1, name, symbol, initialAdmin: creator, decimals }]);
const data = encodeFunctionData({ abi: FACTORY_ABI, functionName: "createB20", args: [0, salt, params, []] });

const preimage = [
  "SIGNA b20 launch v1", `ts:${ts}`, `creator:${creator.toLowerCase()}`, `variant:ASSET`,
  `name:${name}`, `symbol:${symbol}`, `decimals:${decimals}`, `currency:`,
  `salt:${salt}`, `params:${sha256(params)}`, `address:`,
].join("\n");

const signature = await attestor.signMessage({ message: preimage });
const recovered = (await recoverMessageAddress({ message: preimage, signature })).toLowerCase();
const ok = recovered === attestor.address.toLowerCase();

console.log("B20 attestor:   ", attestor.address.toLowerCase());
console.log("createB20 data: ", data.slice(0, 50) + "…", `(${(data.length - 2) / 2} bytes)`);
console.log("salt:           ", salt);
console.log("signature:      ", signature.slice(0, 24) + "…");
console.log("recovered:      ", recovered);
console.log(ok ? "✅ VALID — receipt recovers to the SIGNA B20 attestor" : "❌ INVALID — mismatch");
process.exit(ok ? 0 : 1);
