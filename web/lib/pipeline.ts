/**
 * Signed Pipelines — run a multi-provider capability pipeline and emit a single
 * wallet-signed, hash-chained provenance chain; and verify such a chain.
 *
 * The gateway wallet (deterministic, holds no funds) signs each link. Each
 * link's `prev` is the sha256 of the previous link's signature, so the chain is
 * tamper-evident: change any step and every downstream signature breaks. The
 * run also returns each step's real output, so a verifier can recompute the
 * input/output hashes and confirm the signed links match.
 *
 * Honest scope: this proves PROVENANCE (who produced what, in what order),
 * not correctness of the content. Orchestration is SIGNA's; the proof is
 * re-verifiable by anyone with viem, no trust in SIGNA required.
 */
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes, verifyMessage } from "viem";
import { randomUUID } from "node:crypto";
import { fulfillAny } from "@/lib/fulfill";
import { sha256hex, hashJson, linkPreimage, resolveTemplate, GENESIS, type PipelineLink } from "@/lib/pipeline-core";

// same attestation identity that signs capability results (holds no funds)
const gateway = privateKeyToAccount(keccak256(toBytes("signa:capability-gateway:v1")));

export type PipelineStep = { cap: string; arg?: string };
export type RunStep = { step: number; cap: string; provider: string; source: string; kind: string; input: string; output: unknown; error?: string };
export type SignedLink = PipelineLink & { signature: string };

export interface PipelineRun {
  ok: boolean;
  runId: string;
  steps: RunStep[];
  chain: SignedLink[];
  root: string;
  gateway: string;
  completed: boolean;
  verify: { scheme: string; how: string };
}

export async function runPipeline(steps: PipelineStep[]): Promise<PipelineRun> {
  const runId = randomUUID();
  const outputs: unknown[] = [];
  const runSteps: RunStep[] = [];
  const chain: SignedLink[] = [];
  let prev = GENESIS;
  let completed = true;

  for (let i = 0; i < steps.length; i++) {
    const cap = String(steps[i]?.cap ?? "").trim();
    const input = resolveTemplate(String(steps[i]?.arg ?? ""), outputs);
    let output: unknown = null;
    let provider = "unknown";
    let source = "unknown";
    let kind = "unknown";
    let error: string | undefined;
    try {
      const f = await fulfillAny(cap, input);
      output = f.output;
      provider = f.provider;
      source = f.source;
      kind = f.kind;
    } catch (e) {
      error = e instanceof Error ? e.message : "failed";
    }
    outputs.push(output);

    const ts = Date.now();
    const link: PipelineLink = {
      step: i,
      cap,
      provider,
      kind,
      input,
      input_hash: sha256hex(input),
      output_hash: hashJson(output),
      prev,
      ts,
    };
    const signature = await gateway.signMessage({ message: linkPreimage(runId, link) });
    chain.push({ ...link, signature });
    runSteps.push({ step: i, cap, provider, source, kind, input, output, ...(error ? { error } : {}) });
    prev = sha256hex(signature);

    if (error) { completed = false; break; } // stop on failure — earlier steps already ran + are signed
  }

  const root = chain.length ? sha256hex(chain[chain.length - 1].signature) : GENESIS;
  return {
    ok: true,
    runId,
    steps: runSteps,
    chain,
    root,
    gateway: gateway.address.toLowerCase(),
    completed,
    verify: {
      scheme: "eip191-hashchain",
      how: "for each link rebuild linkPreimage(runId, link) and verifyMessage against `gateway`; confirm link.prev == sha256(previous link.signature) (step 0 == 'genesis'); confirm root == sha256(last link.signature). With the step outputs you can also recompute output_hash = sha256(JSON.stringify(output)).",
    },
  };
}

export type LinkVerdict = { step: number; cap: string; sig_ok: boolean; chain_ok: boolean; output_hash_ok: boolean | null };

/** Re-verify a provenance chain. `steps` is optional; when present, output hashes are checked too. */
export async function verifyPipeline(args: { runId: string; chain: SignedLink[]; steps?: RunStep[]; root?: string }): Promise<{
  ok: boolean;
  valid: boolean;
  root_ok: boolean;
  links: LinkVerdict[];
}> {
  const { runId, chain } = args;
  const links: LinkVerdict[] = [];
  let prev = GENESIS;
  let allOk = chain.length > 0;

  for (let i = 0; i < chain.length; i++) {
    const l = chain[i];
    const pre = linkPreimage(runId, {
      step: l.step, cap: l.cap, provider: l.provider, kind: l.kind,
      input: l.input, input_hash: l.input_hash, output_hash: l.output_hash, prev: l.prev, ts: l.ts,
    });
    let sigOk = false;
    try { sigOk = await verifyMessage({ address: gateway.address, message: pre, signature: l.signature as `0x${string}` }); } catch { sigOk = false; }
    const chainOk = l.prev === prev;
    let outOk: boolean | null = null;
    if (args.steps && args.steps[i]) {
      outOk = hashJson(args.steps[i].output) === l.output_hash && sha256hex(args.steps[i].input) === l.input_hash;
    }
    if (!sigOk || !chainOk || outOk === false) allOk = false;
    links.push({ step: l.step, cap: l.cap, sig_ok: sigOk, chain_ok: chainOk, output_hash_ok: outOk });
    prev = sha256hex(l.signature);
  }

  const computedRoot = chain.length ? sha256hex(chain[chain.length - 1].signature) : GENESIS;
  const rootOk = args.root ? args.root === computedRoot : true;
  return { ok: true, valid: allOk && rootOk, root_ok: rootOk, links };
}
