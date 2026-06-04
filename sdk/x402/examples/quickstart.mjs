// signa-x402 quickstart — proves the SDK against live prod.
// Mints a receipt via the demo endpoint, then reads + re-verifies it through
// the SDK. Run after build:  node examples/quickstart.mjs
import { getReceipt, verifyReceipt, receiptUrl } from "../dist/index.js";

const BASE = process.env.SIGNA_BASE ?? "https://www.signaagent.xyz";

// 1. a seller would normally call issueReceipt() after verifying an x402
//    payment. Here we use the live demo endpoint to mint a real one.
const demo = await (await fetch(`${BASE}/api/x402/demo`, { method: "POST" })).json();
if (!demo.ok) throw new Error("demo failed: " + JSON.stringify(demo));
const id = demo.receipt.id;
console.log("minted receipt:", receiptUrl(id, { baseUrl: BASE }));

// 2. anyone can fetch it
const receipt = await getReceipt(id, { baseUrl: BASE });
console.log("amount:", Number(BigInt(receipt.amount)) / 1e6, "USDC  buyer→seller:",
  receipt.buyer.slice(0, 10), "→", receipt.seller.slice(0, 10));

// 3. and re-verify it — no trust in SIGNA
const v = await verifyReceipt(receipt, { baseUrl: BASE });
console.log("verify:", JSON.stringify({ valid: v.valid, matches: v.matches, role: v.signer_role }));
if (!v.valid) throw new Error("receipt did not verify");
console.log("ok ✓");
