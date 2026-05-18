/**
 * One-time bot wallet bundle minter.
 *
 * Generates 3 fresh Base wallets (one each for MiroShark, gitlawb,
 * Bankr feed bots) plus a MiroShark webhook HMAC secret. Prints the
 * values to stdout for you to paste into Vercel env vars.
 *
 * Usage:
 *   node web/scripts/mint-bots.mjs
 */

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";

function mintBot(kind, basename) {
  const pk = generatePrivateKey();
  const acct = privateKeyToAccount(pk);
  return { kind, basename, key: pk, address: acct.address };
}

const bots = [
  mintBot("MIROSHARK", "miroshark.bot.signa"),
  mintBot("GITLAWB", "gitlawb.bot.signa"),
  mintBot("BANKR", "bankr.bot.signa"),
];

const webhookSecret = randomBytes(32).toString("hex");
const cronSecret = randomBytes(32).toString("hex");

console.log("\n========================================================");
console.log(" SIGNA bot bundle — paste into Vercel env, then redeploy");
console.log("========================================================\n");

for (const b of bots) {
  console.log(`### ${b.kind} bot (${b.basename})`);
  console.log(`Public address (informational, not an env var):`);
  console.log(`  ${b.address}`);
  console.log(``);
  console.log(`Env var to set on Vercel:`);
  console.log(`  Name:  ${b.kind}_BOT_KEY`);
  console.log(`  Value: ${b.key}`);
  console.log(``);
}

console.log("### MiroShark webhook secret");
console.log("Used to HMAC-verify incoming MiroShark webhooks. Set the");
console.log("SAME value as WEBHOOK_SECRET on every MiroShark instance");
console.log("whose generic webhook URL points at SIGNA.");
console.log(``);
console.log(`  Name:  MIROSHARK_WEBHOOK_SECRET`);
console.log(`  Value: ${webhookSecret}`);
console.log(``);

console.log("### CRON_SECRET (for external schedulers to authorize the pollers)");
console.log("Use this in cron-job.org as a query param:");
console.log("  https://www.signaagent.xyz/api/cron/bankr?key=<CRON_SECRET>");
console.log("  https://www.signaagent.xyz/api/cron/gitlawb?key=<CRON_SECRET>");
console.log(``);
console.log(`  Name:  CRON_SECRET`);
console.log(`  Value: ${cronSecret}`);
console.log(``);

console.log("========================================================");
console.log(" 5 env vars total. Paste each one in Vercel:");
console.log("   Project Settings → Environment Variables → Add New");
console.log(" Then redeploy from the Deployments tab.");
console.log("========================================================\n");
