/**
 * Wire-contract tests for the canonical preimage builders. These strings must
 * stay bit-for-bit identical to the server's buildMessageToSign (web/lib/
 * feed-types.ts) — any drift silently breaks signature verification, so we pin
 * the exact bytes here. Run with Node's built-in runner (no deps):
 *
 *   node --test "src/**\/*.test.ts"   (or: npm test)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDmPreimage,
  buildBridgeRegisterPreimage,
  buildBridgeHeartbeatPreimage,
  buildDmPriceSetPreimage,
} from "./envelope.ts";

const TS = 1_700_000_000_000;

test("buildDmPreimage: basic, lowercases from/to, omits default opts", () => {
  assert.equal(
    buildDmPreimage("0xAbC", "0xDeF", "hello", TS, {}),
    `SIGDA agent dm v1\nts:${TS}\nfrom:0xabc\nto:0xdef\nbody:hello`,
  );
  // default body_type "text" and default protocol "sigda.dm.v1" produce NO opt lines
  assert.equal(
    buildDmPreimage("0xA", "0xB", "x", TS, { body_type: "text", protocol: "sigda.dm.v1" }),
    `SIGDA agent dm v1\nts:${TS}\nfrom:0xa\nto:0xb\nbody:x`,
  );
});

test("buildDmPreimage: opt lines in the exact order body_type, protocol, in_reply_to", () => {
  assert.equal(
    buildDmPreimage("0xA", "0xB", "hi", TS, { body_type: "json", protocol: "sigda.dm.v2", in_reply_to: "rid-1" }),
    `SIGDA agent dm v1\nts:${TS}\nfrom:0xa\nto:0xb\nbody_type:json\nprotocol:sigda.dm.v2\nin_reply_to:rid-1\nbody:hi`,
  );
  // body is the LAST line and is never lowercased / trimmed
  assert.equal(
    buildDmPreimage("0xA", "0xB", "  Mixed CASE body  ", TS, { in_reply_to: "rid-2" }),
    `SIGDA agent dm v1\nts:${TS}\nfrom:0xa\nto:0xb\nin_reply_to:rid-2\nbody:  Mixed CASE body  `,
  );
});

test("buildBridgeRegisterPreimage: lowercases address+platform key, preserves model/label/prose case", () => {
  assert.equal(
    buildBridgeRegisterPreimage("0xABC", TS, { platform: "Hermes", model: "Hermes 4", label: "my agent" }),
    [
      "SIGDA agent bridge register v1",
      `ts:${TS}`,
      "address:0xabc",
      "platform:hermes",
      "model:Hermes 4",
      "label:my agent",
      "I am operating an agent bridge between SIGDA's DM substrate and",
      "the Hermes platform. My wallet receives DMs on SIGDA",
      "and forwards them to the model above, then signs the reply and",
      "posts it back. I can deregister at any time.",
    ].join("\n"),
  );
});

test("buildBridgeRegisterPreimage: optional description + capabilities slot before the prose", () => {
  const out = buildBridgeRegisterPreimage("0xA", TS, {
    platform: "ollama",
    model: "hermes3",
    label: "node",
    description: "a local bridge",
    capabilities: ["chat", "code"],
  });
  assert.match(out, /\nlabel:node\ndescription:a local bridge\ncapabilities:chat,code\nI am operating/);
});

test("buildBridgeHeartbeatPreimage: exact", () => {
  assert.equal(
    buildBridgeHeartbeatPreimage("0xABC", TS),
    `SIGDA agent bridge heartbeat v1\nts:${TS}\naddress:0xabc`,
  );
});

test("buildDmPriceSetPreimage: set includes asset/pay_to/chain (lowercased), defaults applied", () => {
  assert.equal(
    buildDmPriceSetPreimage({ address: "0xABC", price_raw: "10000", asset_address: "0xUSDC", pay_to: "0xPAY", chain: "Base", ts: TS }),
    `SIGDA dm price set v1\nts:${TS}\naddress:0xabc\nprice:10000\nasset:0xusdc\npay_to:0xpay\nchain:base`,
  );
  // pay_to defaults to address, chain defaults to robinhood, asset defaults to ""
  assert.equal(
    buildDmPriceSetPreimage({ address: "0xABC", price_raw: "5", ts: TS }),
    `SIGDA dm price set v1\nts:${TS}\naddress:0xabc\nprice:5\nasset:\npay_to:0xabc\nchain:robinhood`,
  );
});

test("buildDmPriceSetPreimage: clearing (price 0 / empty) omits asset/pay_to/chain", () => {
  const cleared = `SIGDA dm price set v1\nts:${TS}\naddress:0xabc\nprice:0`;
  assert.equal(buildDmPriceSetPreimage({ address: "0xABC", price_raw: "0", ts: TS }), cleared);
  assert.equal(buildDmPriceSetPreimage({ address: "0xABC", price_raw: "", ts: TS }), `SIGDA dm price set v1\nts:${TS}\naddress:0xabc\nprice:`);
});
