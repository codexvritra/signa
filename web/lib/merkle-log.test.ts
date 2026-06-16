/**
 * Unit tests for the RFC 6962 Merkle log core. Run with: npm test
 * (node --test, native TS). These are the bits that MUST be exactly right —
 * inclusion + consistency proofs are the integrity guarantee of the
 * transparency log, so we cross-check generation against verification across
 * every size and index, and assert tampering fails.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  leafHash,
  merkleRoot,
  inclusionPath,
  rootFromInclusion,
  verifyInclusion,
  consistencyProof,
  verifyConsistency,
} from "./merkle-log.ts";

const leaves = (n: number) => Array.from({ length: n }, (_, i) => leafHash(`entry-${i}`));

// RFC 6962 known shape: a 1-leaf tree's root IS the leaf hash.
test("single-leaf root equals the leaf hash", () => {
  const l = leaves(1);
  assert.equal(merkleRoot(l), l[0]);
});

// RFC 6962 §2.1: MTH(d0,d1) = nodeHash(leaf0, leaf1) — check inclusion both sides.
test("two-leaf inclusion both indices", () => {
  const l = leaves(2);
  const root = merkleRoot(l);
  for (const m of [0, 1]) {
    const path = inclusionPath(m, l);
    assert.equal(path.length, 1);
    assert.ok(verifyInclusion(l[m], m, 2, path, root));
  }
});

// The big one: for every tree size and every index, the inclusion proof must
// reproduce exactly the full-tree root. This catches any audit-path or
// verification bug across all tree shapes (powers of two AND ragged trees).
test("inclusion reproduces the full root for all sizes/indices (1..130)", () => {
  for (let n = 1; n <= 130; n++) {
    const l = leaves(n);
    const root = merkleRoot(l);
    for (let m = 0; m < n; m++) {
      const path = inclusionPath(m, l);
      const got = rootFromInclusion(l[m], m, n, path);
      assert.equal(got, root, `size=${n} index=${m}`);
    }
  }
});

test("inclusion proof fails on a tampered leaf", () => {
  const n = 37;
  const l = leaves(n);
  const root = merkleRoot(l);
  const m = 19;
  const path = inclusionPath(m, l);
  const tampered = leafHash("entry-19-altered");
  assert.equal(verifyInclusion(tampered, m, n, path, root), false);
});

test("inclusion proof fails on a wrong index", () => {
  const n = 50;
  const l = leaves(n);
  const root = merkleRoot(l);
  const m = 10;
  const path = inclusionPath(m, l);
  assert.equal(verifyInclusion(l[m], 11, n, path, root), false);
});

// Consistency: the size-m tree must be a verifiable prefix of the size-n tree,
// for every 1 <= m <= n. This is the append-only guarantee.
test("consistency holds as a prefix for all (m,n) up to 96", () => {
  for (let n = 1; n <= 96; n++) {
    const l = leaves(n);
    const newRoot = merkleRoot(l);
    for (let m = 1; m <= n; m++) {
      const oldRoot = merkleRoot(l.slice(0, m));
      const proof = consistencyProof(m, l);
      assert.ok(verifyConsistency(m, n, oldRoot, newRoot, proof), `m=${m} n=${n}`);
    }
  }
});

test("consistency fails when the older root is wrong (rewrite attempt)", () => {
  const n = 64;
  const l = leaves(n);
  const newRoot = merkleRoot(l);
  const m = 20;
  const proof = consistencyProof(m, l);
  const forgedOld = merkleRoot(leaves(m).map((_, i) => leafHash(`forged-${i}`)));
  assert.equal(verifyConsistency(m, n, forgedOld, newRoot, proof), false);
});

test("consistency fails when a covered entry changed (not append-only)", () => {
  const n = 40;
  const l = leaves(n);
  const m = 25;
  const oldRoot = merkleRoot(l.slice(0, m));
  const proof = consistencyProof(m, l);
  // now pretend the current tree rewrote entry 5
  const rewritten = l.slice();
  rewritten[5] = leafHash("entry-5-rewritten");
  const newRootRewritten = merkleRoot(rewritten);
  assert.equal(verifyConsistency(m, n, oldRoot, newRootRewritten, proof), false);
});
