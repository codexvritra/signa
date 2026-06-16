/**
 * RFC 6962 (Certificate Transparency) Merkle tree — the cryptographic core of
 * the SIGNA transparency log.
 *
 * A wallet signature proves WHO wrote a message. It does not prove the central
 * store didn't later drop, reorder, or alter the set of messages. This module
 * builds an append-only Merkle tree over the signed message log so that:
 *   - any message has an INCLUSION proof against a signed (and on-chain
 *     anchorable) root — tamper with it and the proof fails;
 *   - any two log sizes have a CONSISTENCY proof — the log can be shown to be
 *     append-only (older entries were never rewritten).
 *
 * Hashing follows RFC 6962 exactly:
 *   leaf  hash = SHA256(0x00 || entry)
 *   inner hash = SHA256(0x01 || left || right)
 * Hashes are carried as lowercase hex strings; conversions happen at the edges.
 *
 * Pure (node:crypto only) and deterministic, so an external verifier can
 * reproduce every value with nothing but the ordered entries.
 */
import { createHash } from "node:crypto";

const sha = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");
const hb = (hex: string): Buffer => Buffer.from(hex, "hex");

/** SHA256(0x00 || entry) — the RFC 6962 leaf hash for one log entry. */
export function leafHash(entry: string): string {
  return sha(Buffer.concat([Buffer.from([0x00]), Buffer.from(entry, "utf8")]));
}

/** SHA256(0x01 || left || right) — the RFC 6962 interior node hash. */
function nodeHash(left: string, right: string): string {
  return sha(Buffer.concat([Buffer.from([0x01]), hb(left), hb(right)]));
}

/** Largest power of two strictly less than n (n > 1). */
function k(n: number): number {
  let p = 1;
  while (p << 1 < n) p <<= 1;
  return p;
}

/**
 * Merkle Tree Hash over an array of LEAF HASHES (already leaf-hashed).
 * MTH({}) = SHA256() ; MTH({d0}) = d0 ; else nodeHash(MTH(left k), MTH(rest)).
 */
export function merkleRoot(leaves: string[]): string {
  const n = leaves.length;
  if (n === 0) return sha(Buffer.alloc(0));
  if (n === 1) return leaves[0];
  const s = k(n);
  return nodeHash(merkleRoot(leaves.slice(0, s)), merkleRoot(leaves.slice(s)));
}

/** RFC 6962 §2.1.1 audit path for leaf index m among `leaves` (leaf hashes). */
export function inclusionPath(m: number, leaves: string[]): string[] {
  const n = leaves.length;
  if (n <= 1) return [];
  const s = k(n);
  if (m < s) return [...inclusionPath(m, leaves.slice(0, s)), merkleRoot(leaves.slice(s))];
  return [...inclusionPath(m - s, leaves.slice(s)), merkleRoot(leaves.slice(0, s))];
}

/**
 * RFC 6962 §2.1.1 inclusion verification: recompute the root from a leaf hash,
 * its index, the tree size and the audit path. Returns the computed root (the
 * caller compares it to the signed checkpoint root).
 */
export function rootFromInclusion(leaf: string, m: number, n: number, path: string[]): string {
  if (m >= n) throw new Error("index_out_of_range");
  let fn = m;
  let sn = n - 1;
  let r = leaf;
  for (const p of path) {
    if (sn === 0) throw new Error("path_too_long");
    if ((fn & 1) === 1 || fn === sn) {
      r = nodeHash(p, r);
      if ((fn & 1) === 0) {
        // right-edge: shift until LSB set or fn == 0
        do {
          fn >>= 1;
          sn >>= 1;
        } while ((fn & 1) === 0 && fn !== 0);
      }
    } else {
      r = nodeHash(r, p);
    }
    fn >>= 1;
    sn >>= 1;
  }
  if (sn !== 0) throw new Error("path_too_short");
  return r;
}

/** Convenience: does this inclusion proof reproduce the expected root? */
export function verifyInclusion(leaf: string, m: number, n: number, path: string[], root: string): boolean {
  try {
    return rootFromInclusion(leaf, m, n, path) === root;
  } catch {
    return false;
  }
}

/** RFC 6962 §2.1.3 SUBPROOF, used by consistencyProof. */
function subproof(m: number, leaves: string[], b: boolean): string[] {
  const n = leaves.length;
  if (m === n) return b ? [] : [merkleRoot(leaves)];
  const s = k(n);
  if (m <= s) return [...subproof(m, leaves.slice(0, s), b), merkleRoot(leaves.slice(s))];
  return [...subproof(m - s, leaves.slice(s), false), merkleRoot(leaves.slice(0, s))];
}

/**
 * RFC 6962 §2.1.2 consistency proof between an older tree of size `m` and the
 * current tree (`leaves`, size n ≥ m). Proves the size-m tree is a prefix of
 * the size-n tree — i.e. the log is append-only.
 */
export function consistencyProof(m: number, leaves: string[]): string[] {
  const n = leaves.length;
  if (m <= 0 || m > n) throw new Error("bad_consistency_range");
  if (m === n) return [];
  return subproof(m, leaves, true);
}

/**
 * RFC 6962 §2.1.2 consistency verification. Given the two sizes, the two roots
 * and the proof, confirm the older root is a prefix of the newer one.
 */
export function verifyConsistency(
  m: number,
  n: number,
  oldRoot: string,
  newRoot: string,
  proof: string[],
): boolean {
  try {
    if (m <= 0 || m > n) return false;
    if (m === n) return oldRoot === newRoot && proof.length === 0;

    // Per RFC 6962 §2.1.2 verification algorithm.
    let path = proof;
    // If m is an exact power of two, the old root is prepended implicitly.
    const isPow2 = (m & (m - 1)) === 0;
    if (isPow2) path = [oldRoot, ...path];
    if (path.length === 0) return false;

    let fn = m - 1;
    let sn = n - 1;
    while ((fn & 1) === 1) {
      fn >>= 1;
      sn >>= 1;
    }

    let fr = path[0];
    let sr = path[0];
    for (let i = 1; i < path.length; i++) {
      const c = path[i];
      if (sn === 0) return false;
      if ((fn & 1) === 1 || fn === sn) {
        fr = nodeHash(c, fr);
        sr = nodeHash(c, sr);
        if ((fn & 1) === 0) {
          do {
            fn >>= 1;
            sn >>= 1;
          } while ((fn & 1) === 0 && fn !== 0);
        }
      } else {
        sr = nodeHash(sr, c);
      }
      fn >>= 1;
      sn >>= 1;
    }
    return fr === oldRoot && sr === newRoot && sn === 0;
  } catch {
    return false;
  }
}
