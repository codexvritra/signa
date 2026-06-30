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

// SignaMessages contract on Base — send(to, body) emits a readable Message event.
const SIGNA_MESSAGES = (process.env.CONTRACT || "0x142770698171a8e76b6268963a5a531ec4b64ad9").toLowerCase();
function encodeSend(to, body) {
  const addr = norm(to).replace(/^0x/, "").padStart(64, "0");
  const offset = (64).toString(16).padStart(64, "0");
  const bytes = new TextEncoder().encode(body);
  const len = bytes.length.toString(16).padStart(64, "0");
  let hex = ""; for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  hex += "0".repeat((64 - (hex.length % 64)) % 64);
  return "0x99142b5f" + addr + offset + len + hex; // selector send(address,string)
}
async function msg(to, body) {
  const pk = process.env.PK;
  if (!pk) throw new Error("set PK=0x… (the sending wallet's private key, needs Base ETH for gas)");
  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) throw new Error(`bad recipient: ${to}`);
  if (!body) throw new Error("message body is required");
  const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
  const wallet = createWalletClient({ account, chain: base, transport: http(RPC) });
  console.log(`recording message ${norm(account.address)} → ${norm(to)} via SignaMessages ${SIGNA_MESSAGES} …`);
  const hash = await wallet.sendTransaction({ to: SIGNA_MESSAGES, value: 0n, data: encodeSend(to, body) });
  console.log("tx:        ", hash);
  console.log("explorer:  ", `https://basescan.org/tx/${hash}`);
  console.log("\nit's a readable Message event on Base now.");
}

function compose(from, to, body) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(from)) throw new Error("set FROM=0x… (your wallet) or PK=0x… so I can derive it");
  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) throw new Error(`bad recipient: ${to}`);
  if (!body) throw new Error("message body is required");
  const data = buildData({ from, to: norm(to), body });
  // The wallet-agnostic transaction request. Paste `data` into a wallet's hex
  // field (MetaMask/Rabby: enable "hex data"), or hand {to,value,data} to any
  // injected provider / WalletConnect request. No website, no SIGNA node.
  console.log(JSON.stringify({ to: norm(to), value: "0x0", data, chainId: "0x2105" }, null, 2));
  console.log("\nhex data to paste into your wallet's send screen:\n" + data);
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
  if (cmd === "msg") await msg(a, b);
  else if (cmd === "send") await send(a, b);
  else if (cmd === "read") await read(a);
  else if (cmd === "data") {
    let from = process.env.FROM;
    if (!from && process.env.PK) { const { privateKeyToAccount } = await import("viem/accounts"); from = privateKeyToAccount(process.env.PK.startsWith("0x") ? process.env.PK : `0x${process.env.PK}`).address; }
    compose(norm(from || ""), a, b);
  } else {
    console.log("usage:\n  PK=0x… node onchain-message.mjs msg  <0xrecipient> \"message\"   # via SignaMessages contract → readable Basescan event (recommended)\n  PK=0x… node onchain-message.mjs send <0xrecipient> \"message\"   # raw calldata to the recipient\n  node onchain-message.mjs read <0xtxhash>\n  FROM=0xyou node onchain-message.mjs data <0xrecipient> \"message\"   # prints the tx + hex to paste into any wallet");
    process.exit(1);
  }
} catch (e) {
  console.error("error:", e.message || e);
  process.exit(1);
}
