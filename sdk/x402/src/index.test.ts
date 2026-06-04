import { test } from "node:test";
import assert from "node:assert/strict";
import { receiptUrl, receiptHeaders, DEFAULT_BASE } from "./index.ts";

test("receiptUrl builds the public permalink", () => {
  assert.equal(receiptUrl("abc"), `${DEFAULT_BASE}/x402/abc`);
  assert.equal(receiptUrl("abc", { baseUrl: "https://x.test" }), "https://x.test/x402/abc");
});

test("receiptHeaders expose the receipt url + id", () => {
  const h = receiptHeaders({ id: "rid" } as never);
  assert.equal(h["x-signa-receipt-id"], "rid");
  assert.equal(h["x-signa-receipt"], `${DEFAULT_BASE}/x402/rid`);
});
