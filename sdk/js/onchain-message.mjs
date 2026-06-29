#!/usr/bin/env node
/**
 * onchain-message.mjs — write/read a SIGNA message ON BASE, with no SIGNA
 * website and no SIGNA node. The message is just a 0-value Base transaction
 * whose calldata is `SIGNA msg v1\nfrom:…\nto:…\nbody:…`. The tx is signed by
 * the sender's wallet, so the chain itself proves who sent it.
 *
 * The whole "messaging layer" is this one fact: a Base tx with that calldata.
 * You don't need us to send or read one — you need a wallet, gas, and an RPC.
 *
 * Requires viem (`npm i viem`).
 *
 *   # send (costs a little Base ETH for gas)
 *   PK=0xYOUR_PRIVATE_KEY \
 *   node onchain-message.mjs send 0xRecipientAddress "gm, this lives on Base forever"
 *
 *   # read any onchain message straight from the chain
 *   node onchain-message.mjs read 0xTransactionHash
 *
 *   # optional: point at your own RPC
 *   RPC=https://your-base-rpc node onchain-message.mjs read 0x…
 */
import { createWalletClient, createPublicClient, http, toHex, hexToString } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const PREFIX = "SIGNA msg v1";
const RPC = process.env.RPC || "https://mainnet.base.org";
const norm = (a) => String(a).toLowerCase();

function buildData({ from, to, body }) {
  return toHex(`${PREFIX}\nfrom:${norm(from)}\nto:${norm(to)}\nbody:${body}`);
}

function decode(inputHex) {
  if (!inputHex || inputHex === "0x") return null;
  let s;
  try { s = hexToString(inputHex); } catch { return null; }
  if (!s.startsWith(PREFIX)) return null;
  const from = norm((s.match(/\nfrom:([^\n]*)/)?.[1] ?? "").trim());
  const to = norm((s.match(/\nto:([^\n]*)/)?.[1] ?? "").trim());
  const i = s.indexOf("\nbody:");
  return { from, to, body: i >= 0 ? s.slice(i + 6) : "" };
}

async function send(to, body) {
  const pk = process.env.PK;
  if (!pk) throw new Error("set PK=0x… (the sending wallet's private key, needs Base ETH for gas)");
  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) throw new Error(`bad recipient: ${to}`);
  if (!body) throw new Error("message body is required");
  const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
  const from = norm(account.address);
  const wallet = createWalletClient({ account, chain: base, transport: http(RPC) });
  const data = buildData({ from, to: norm(to), body });
  console.log(`sending onchain message ${from} → ${norm(to)} …`);
  const hash = await wallet.sendTransaction({ to: norm(to), value: 0n, data });
  console.log("tx:        ", hash);
  console.log("explorer:  ", `https://basescan.org/tx/${hash}`);
  console.log("\nit's on Base now. read it back with:\n  node onchain-message.mjs read " + hash);
}

async function read(txHash) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new Error(`bad tx hash: ${txHash}`);
  const client = createPublicClient({ chain: base, transport: http(RPC) });
  const tx = await client.getTransaction({ hash: txHash });
  const msg = decode(tx.input);
  if (!msg) { console.log("not a SIGNA onchain message"); return; }
  const txFrom = norm(tx.from);
  console.log(JSON.stringify({
    tx: txHash,
    from: msg.from,
    to: msg.to,
    body: msg.body,
    block: String(tx.blockNumber ?? ""),
    // the chain's proof of authorship: the tx's own sender must equal the claimed from
    sender_matches: txFrom === msg.from,
  }, null, 2));
}

const [cmd, a, b] = process.argv.slice(2);
try {
  if (cmd === "send") await send(a, b);
  else if (cmd === "read") await read(a);
  else {
    console.log("usage:\n  PK=0x… node onchain-message.mjs send <0xrecipient> \"message\"\n  node onchain-message.mjs read <0xtxhash>");
    process.exit(1);
  }
} catch (e) {
  console.error("error:", e.message || e);
  process.exit(1);
}
