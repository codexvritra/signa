/**
 * Pure core of Signed Pipelines: template resolution, canonical link preimage,
 * and hashing. No network, no signing, no Supabase — so it is unit-testable
 * (see pipeline-core.test.ts). pipeline.ts adds fulfilment + wallet signing.
 *
 * A pipeline run produces a PROVENANCE CHAIN: an ordered list of links, each
 *   link = { step, cap, provider, input_hash, output_hash, prev, ts }
 * signed by the gateway wallet, where prev = sha256(previous link's signature).
 * That chain is re-verifiable by anyone with viem — it proves WHICH provider
 * produced WHAT, in WHAT ORDER. Provenance, not correctness.
 */
import { createHash } from "node:crypto";

export const GENESIS = "genesis";

export const sha256hex = (s: string): string => createHash("sha256").update(s).digest("hex");
export const hashJson = (v: unknown): string => sha256hex(JSON.stringify(v ?? null));

export type PipelineLink = {
  step: number;
  cap: string;
  provider: string;
  kind: string;
  input: string;
  input_hash: string;
  output_hash: string;
  prev: string; // sha256 of the previous link's signature, or GENESIS for step 0
  ts: number;
};

/** Canonical preimage the gateway signs for one link (bit-for-bit on verify). */
export function linkPreimage(runId: string, l: PipelineLink): string {
  return [
    "SIGNA pipeline link v1",
    `run:${runId}`,
    `step:${l.step}`,
    `cap:${l.cap}`,
    `provider:${l.provider.toLowerCase()}`,
    `input:${l.input_hash}`,
    `output:${l.output_hash}`,
    `prev:${l.prev}`,
    `ts:${l.ts}`,
  ].join("\n");
}

function getPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

/**
 * Resolve template references in a step's arg against prior step outputs:
 *   {{prev}}            → the previous step's whole output (JSON if not a string)
 *   {{prev.a.b}}        → a nested field of the previous output
 *   {{2.output.score}}  → field of step 2's output ("output." prefix optional)
 *   {{0.price_usd}}     → same, without the prefix
 * Unknown references resolve to an empty string (never throws).
 */
export function resolveTemplate(arg: string, outputs: unknown[]): string {
  if (!arg || !arg.includes("{{")) return arg ?? "";
  return arg.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, expr) => {
    const e = String(expr).trim();
    let idx: number;
    let path: string;
    if (e === "prev" || e.startsWith("prev.")) {
      idx = outputs.length - 1;
      path = e === "prev" ? "" : e.slice(5);
    } else {
      const m = e.match(/^(\d+)(?:\.(.+))?$/);
      if (!m) return "";
      idx = Number(m[1]);
      path = (m[2] ?? "").replace(/^output\.?/, "");
    }
    if (idx < 0 || idx >= outputs.length) return "";
    const val = getPath(outputs[idx], path);
    if (val == null) return "";
    return typeof val === "string" ? val : JSON.stringify(val);
  });
}
