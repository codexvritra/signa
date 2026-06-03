/**
 * Unit tests for the Signed Pipelines pure core. Run with: npm test
 * (node --test, native TS). Covers template resolution + the canonical link
 * preimage — the bits that must be deterministic for the chain to re-verify.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTemplate, linkPreimage, hashJson, sha256hex, GENESIS, type PipelineLink } from "./pipeline-core.ts";

const OUTPUTS = [{ score: 21, label: "extreme fear" }, { price_usd: 1865.5 }];

test("resolveTemplate: literal passthrough + no-brace fast path", () => {
  assert.equal(resolveTemplate("just text", OUTPUTS), "just text");
  assert.equal(resolveTemplate("", OUTPUTS), "");
});

test("resolveTemplate: {{prev}} and {{prev.field}}", () => {
  assert.equal(resolveTemplate("{{prev}}", OUTPUTS), JSON.stringify(OUTPUTS[1]));
  assert.equal(resolveTemplate("{{prev.price_usd}}", OUTPUTS), "1865.5");
});

test("resolveTemplate: {{i.output.field}} and {{i.field}} both work", () => {
  assert.equal(resolveTemplate("{{0.output.score}}", OUTPUTS), "21");
  assert.equal(resolveTemplate("{{0.label}}", OUTPUTS), "extreme fear");
  assert.equal(resolveTemplate("{{1.price_usd}}", OUTPUTS), "1865.5");
});

test("resolveTemplate: mixed text + multiple refs", () => {
  assert.equal(
    resolveTemplate("given {{0.label}} and ETH ${{1.price_usd}}", OUTPUTS),
    "given extreme fear and ETH $1865.5",
  );
});

test("resolveTemplate: unknown / out-of-range refs resolve to empty string", () => {
  assert.equal(resolveTemplate("{{9.x}}", OUTPUTS), "");
  assert.equal(resolveTemplate("{{0.nope}}", OUTPUTS), "");
  assert.equal(resolveTemplate("a{{garbage}}b", OUTPUTS), "ab");
});

test("resolveTemplate: object field serializes to JSON", () => {
  assert.equal(resolveTemplate("{{0}}", OUTPUTS), JSON.stringify(OUTPUTS[0]));
});

test("hashJson / sha256hex are deterministic and null-safe", () => {
  assert.equal(hashJson({ a: 1 }), hashJson({ a: 1 }));
  assert.equal(hashJson(null), hashJson(undefined)); // both -> "null"
  assert.equal(sha256hex("x").length, 64);
});

test("linkPreimage: canonical, lowercases provider", () => {
  const l: PipelineLink = {
    step: 0, cap: "root.feargreed", provider: "0xAbC", kind: "builtin",
    input: "", input_hash: "ih", output_hash: "oh", prev: GENESIS, ts: 1700000000000,
  };
  assert.equal(
    linkPreimage("run-1", l),
    "SIGNA pipeline link v1\nrun:run-1\nstep:0\ncap:root.feargreed\nprovider:0xabc\ninput:ih\noutput:oh\nprev:genesis\nts:1700000000000",
  );
});
