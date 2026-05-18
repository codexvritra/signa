import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);
const dbEncryptionKey = randomBytes(32).toString("hex");

console.log("\n========== NEW AGENT WALLET ==========\n");
console.log("Public address (share this — this is how others message your agent):");
console.log(`  ${account.address}\n`);

console.log("Paste these into Railway → Variables (for this agent's service):\n");
console.log(`XMTP_WALLET_KEY=${privateKey}`);
console.log(`XMTP_DB_ENCRYPTION_KEY=${dbEncryptionKey}\n`);

console.log("WARNING:");
console.log("  - DO NOT commit these.");
console.log("  - DO NOT paste them anywhere public.");
console.log("  - XMTP_WALLET_KEY is the agent's identity — losing it = losing the agent forever.");
console.log("  - This script prints them once. Save them in Railway env vars now.\n");
