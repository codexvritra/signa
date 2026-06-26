// Offline proof of the B20 reserve-attestation loop: build → issuer signs → recover.
//   run from web/:  node scripts/verify-b20-reserves.mjs
import { recoverMessageAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createHash } from "node:crypto";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const issuer = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");

const token = "0xb20100000000000000000099aa11bb22cc33dd44";
const reserve_amount = "1000000.00", reserve_asset = "USDC";
const statement = "USAGD is fully backed 1:1 by USDC held in a segregated Base wallet.";
const ts = 1750000000000, as_of = 1750000000000;

const preimage = [
  "SIGNA b20 reserves v1", `ts:${ts}`, `token:${token.toLowerCase()}`, `issuer:${issuer.address.toLowerCase()}`,
  `reserve:${reserve_amount} ${reserve_asset}`, `as_of:${as_of}`, `statement:${sha256(statement)}`,
].join("\n");
const signature = await issuer.signMessage({ message: preimage });
const recovered = (await recoverMessageAddress({ message: preimage, signature })).toLowerCase();
const ok = recovered === issuer.address.toLowerCase();

console.log("issuer:    ", issuer.address.toLowerCase());
console.log("token:     ", token);
console.log("reserve:   ", `${reserve_amount} ${reserve_asset}`);
console.log("statement: ", JSON.stringify(statement));
console.log("signature: ", signature.slice(0, 24) + "…");
console.log("recovered: ", recovered);
console.log(ok ? "✅ reserve attestation recovers to the issuer" : "❌ mismatch");
process.exit(ok ? 0 : 1);
