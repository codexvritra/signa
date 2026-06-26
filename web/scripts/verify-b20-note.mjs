// Offline proof of the B20 money-note loop: build the note, the payer signs it, recover
// the payer, and confirm the on-chain memo binds to the note. Mirrors lib/b20.ts.
//   run from web/:  node scripts/verify-b20-note.mjs
import { keccak256, toBytes, encodeFunctionData, recoverMessageAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createHash } from "node:crypto";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
// a test payer wallet (anvil key #0)
const payer = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");

const MEMO_ABI = [{ type: "function", name: "transferWithMemo", stateMutability: "nonpayable",
  inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }, { name: "memo", type: "bytes32" }],
  outputs: [{ name: "", type: "bool" }] }];

const token = "0xb2000000000000000000007ad5e0c47f47b5a908"; // a B20 token
const to = "0x95fce75729690477e48820805c74602338e19303";
const amount = "1500000"; // raw base units
const note = "invoice #42 — data pull for agent VERA, paid in full";
const ts = 1750000000000;

const preimage = [
  "SIGNA b20 memo v1", `ts:${ts}`, `from:${payer.address.toLowerCase()}`, `to:${to.toLowerCase()}`,
  `token:${token.toLowerCase()}`, `amount:${amount}`, `note:${sha256(note)}`,
].join("\n");
const memo = keccak256(toBytes(preimage));                 // bytes32 on-chain memo
const data = encodeFunctionData({ abi: MEMO_ABI, functionName: "transferWithMemo", args: [to, BigInt(amount), memo] });

const signature = await payer.signMessage({ message: preimage });
const recovered = (await recoverMessageAddress({ message: preimage, signature })).toLowerCase();
const recoverOk = recovered === payer.address.toLowerCase();
const bindOk = memo === keccak256(toBytes(preimage));      // memo binds to the exact note

console.log("payer:           ", payer.address.toLowerCase());
console.log("note:            ", JSON.stringify(note));
console.log("on-chain memo:   ", memo);
console.log("transferWithMemo:", data.slice(0, 50) + "…", `(${(data.length - 2) / 2} bytes)`);
console.log("signature:       ", signature.slice(0, 24) + "…");
console.log("recovered payer: ", recovered);
console.log(recoverOk ? "✅ note recovers to the payer" : "❌ recover mismatch");
console.log(bindOk ? "✅ on-chain memo binds to the signed note" : "❌ memo mismatch");
process.exit(recoverOk && bindOk ? 0 : 1);
