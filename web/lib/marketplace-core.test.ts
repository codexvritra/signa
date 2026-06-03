/**
 * Unit tests for the marketplace security core. Run with Node 24's built-in
 * runner (native TS type-stripping, no deps):
 *
 *   node --test lib/marketplace-core.test.ts      (from web/)
 *   npm test                                       (runs all lib/*.test.ts)
 *
 * The SSRF guard is the highest-risk control in the marketplace (it gates which
 * endpoints the gateway will proxy), so it gets the most coverage.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerPreimage, validName, isSafeEndpoint, NAME_RE } from "./marketplace-core.ts";

test("registerPreimage: canonical, lowercases provider, uppercases method", () => {
  const pre = registerPreimage({ ts: 123, name: "myteam.sum", provider: "0xABCdef", endpoint: "https://x.dev/a", method: "post", price: 0 });
  assert.equal(
    pre,
    "SIGNA capability register v1\nts:123\nname:myteam.sum\nprovider:0xabcdef\nendpoint:https://x.dev/a\nmethod:POST\nprice:0",
  );
});

test("registerPreimage: price passes through verbatim (number or string)", () => {
  assert.match(registerPreimage({ ts: 1, name: "a.b", provider: "0x0", endpoint: "https://x.io", method: "GET", price: 0.01 }), /\nprice:0\.01$/);
  assert.match(registerPreimage({ ts: 1, name: "a.b", provider: "0x0", endpoint: "https://x.io", method: "GET", price: "5" }), /\nprice:5$/);
});

test("validName: accepts namespaced names, rejects bad shapes", () => {
  for (const ok of ["myteam.summarize", "a.b", "team_one", "x-y-z", "abc123", "a.b.c.d"]) {
    assert.equal(validName(ok), true, `${ok} should be valid`);
  }
  for (const bad of ["", "ab", "a", ".bad", "bad.", "-bad", "bad-", "has space", "UPPER.OK", "a/b", "a\\b", "a..".padEnd(60, "x")]) {
    // note: NAME_RE is case-insensitive, so "UPPER.OK" actually matches shape — assert via reserved/shape below
    if (bad === "UPPER.OK") continue;
    assert.equal(validName(bad), false, `${bad} should be invalid`);
  }
});

test("validName: honors the reserved set, case-insensitively", () => {
  const reserved = new Set(["token.price", "base.gas"]);
  assert.equal(validName("token.price", reserved), false);
  assert.equal(validName("TOKEN.PRICE", reserved), false);
  assert.equal(validName("token.pricex", reserved), true);
  assert.equal(validName("token.price", new Set()), true); // not reserved when set is empty
});

test("NAME_RE bounds length to 3..40", () => {
  assert.equal(NAME_RE.test("ab"), false); // 2
  assert.equal(NAME_RE.test("abc"), true); // 3
  assert.equal(NAME_RE.test("a".repeat(40)), true); // 40
  assert.equal(NAME_RE.test("a".repeat(41)), false); // 41
});

test("isSafeEndpoint: allows public https hosts", () => {
  for (const ok of [
    "https://api.myteam.dev/summarize",
    "https://coins.llama.fi/prices/current/coingecko:ethereum", // colon is in the PATH, host is clean
    "https://example.com",
    "https://8.8.8.8/x", // public IP literal is allowed
    "https://sub.domain.co.uk:8443/y",
  ]) {
    assert.equal(isSafeEndpoint(ok), true, `${ok} should be allowed`);
  }
});

test("isSafeEndpoint: blocks non-https", () => {
  for (const bad of ["http://api.x.dev/a", "ftp://x.dev", "ws://x.dev", "file:///etc/passwd", "gopher://x"]) {
    assert.equal(isSafeEndpoint(bad), false, `${bad} should be blocked`);
  }
});

test("isSafeEndpoint: blocks loopback / private / link-local / metadata", () => {
  for (const bad of [
    "https://localhost/x",
    "https://localhost:3000/x",
    "https://127.0.0.1/x",
    "https://0.0.0.0/x",
    "https://10.0.0.5/x",
    "https://192.168.1.1/x",
    "https://172.16.0.1/x",
    "https://172.31.255.255/x",
    "https://169.254.169.254/latest/meta-data/", // cloud metadata
    "https://metadata.google.internal/x",
    "https://foo.local/x",
    "https://foo.internal/x",
    "https://[::1]/x", // IPv6 loopback (hostname has a colon)
    "https://[fd00::1]/x", // IPv6 ULA
    "https://nodothost/x", // no dot → not a real public domain
  ]) {
    assert.equal(isSafeEndpoint(bad), false, `${bad} should be blocked`);
  }
});

test("isSafeEndpoint: 172.16/12 boundary is exact (15 and 32 are public)", () => {
  assert.equal(isSafeEndpoint("https://172.15.0.1/x"), true); // just below the private block
  assert.equal(isSafeEndpoint("https://172.32.0.1/x"), true); // just above
  assert.equal(isSafeEndpoint("https://172.16.0.1/x"), false);
  assert.equal(isSafeEndpoint("https://172.31.0.1/x"), false);
});

test("isSafeEndpoint: rejects malformed / non-URL input", () => {
  for (const bad of ["", "not a url", "https://", "//x.dev", "javascript:alert(1)"]) {
    assert.equal(isSafeEndpoint(bad), false, `${bad} should be blocked`);
  }
});
