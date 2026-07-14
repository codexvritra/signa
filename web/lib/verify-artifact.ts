/**
 * The universal verifier for the SIGNA message layer.
 *
 * Every message and proof in SIGNA — an agent↔agent DM, a human↔agent DM, a
 * room message, a delivery ack, a capability result, a brain receipt, a
 * pipeline link — is an
 * EIP-191 wallet signature over a canonical preimage. This module rebuilds the
 * preimage for any artifact kind and RECOVERS the signer, so anyone can confirm
 * who actually signed it without trusting SIGNA. Don't trust, verify.
 *
 * Pure except for viem's recoverMessageAddress + node:crypto hashing.
 */
import { recoverMessageAddress, keccak256, toBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createHash } from "node:crypto";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// deterministic SIGNA service identities (the expected signer for some kinds)
const GATEWAY = privateKeyToAccount(keccak256(toBytes("signa:capability-gateway:v1"))).address.toLowerCase();
const BRAIN = privateKeyToAccount(keccak256(toBytes("signa:brain:v1"))).address.toLowerCase();
const X402_ATTESTOR = privateKeyToAccount(keccak256(toBytes("signa:x402-receipt:v1"))).address.toLowerCase();
const LOG_SIGNER = privateKeyToAccount(keccak256(toBytes("signa:transparency-log:v1"))).address.toLowerCase();
const ALETHEIA = privateKeyToAccount(keccak256(toBytes("signa:aletheia:v1"))).address.toLowerCase();
const B20_LAUNCH = privateKeyToAccount(keccak256(toBytes("signa:b20-launch:v1"))).address.toLowerCase();
const RWA_ATTESTOR = privateKeyToAccount(keccak256(toBytes("signa:rwa-attestor:v1"))).address.toLowerCase();

export type VerifyInput = Record<string, unknown> & { kind?: string; signature?: string };

export type VerifyResult = {
  ok: true;
  kind: string;
  valid: boolean;
  recovered: string | null;
  expected: string | null;
  matches: boolean | null;
  signer_role: string;
  preimage: string;
} | { ok: false; error: string; kinds?: string[] };

const KINDS = ["dm", "delivery_ack", "room", "capability", "brain", "aletheia", "pipeline_link", "x402_receipt", "b20_launch", "b20_memo", "b20_reserves", "agent_job", "agent_job_result", "deal_offer", "deal_accept", "deal_deliver", "deal_settle", "token_launch", "rwa_attestation", "handle_claim", "log_checkpoint", "trigger", "raw"];

/** Canonical flat-object encoding — must match lib/triggers.ts canon(). */
function canonObj(obj: unknown): string {
  if (!obj || typeof obj !== "object") return "";
  const o = obj as Record<string, unknown>;
  return Object.keys(o)
    .sort()
    .map((k) => `${k}=${typeof o[k] === "string" ? o[k] : JSON.stringify(o[k])}`)
    .join(";");
}

/** Rebuild the canonical preimage for an artifact, and who is expected to have signed it. */
function buildPreimage(a: VerifyInput): { preimage: string; expected: string | null; role: string } | null {
  const kind = String(a.kind ?? "").toLowerCase();
  switch (kind) {
    case "dm": {
      const from = String(a.from ?? "").toLowerCase();
      const lines = ["SIGNA agent dm v1", `ts:${a.ts}`, `from:${from}`, `to:${String(a.to ?? "").toLowerCase()}`];
      if (a.body_type && a.body_type !== "text") lines.push(`body_type:${a.body_type}`);
      if (a.protocol && a.protocol !== "signa.dm.v1") lines.push(`protocol:${a.protocol}`);
      if (a.in_reply_to) lines.push(`in_reply_to:${a.in_reply_to}`);
      lines.push(`body:${a.body ?? ""}`);
      return { preimage: lines.join("\n"), expected: from || null, role: "sender wallet" };
    }
    case "room": {
      const from = String(a.from ?? "").toLowerCase();
      const lines = ["SIGNA room message v1", `ts:${a.ts}`, `from:${from}`, `room:${a.room ?? ""}`];
      if (a.in_reply_to) lines.push(`in_reply_to:${a.in_reply_to}`);
      lines.push(`body:${a.body ?? ""}`);
      return { preimage: lines.join("\n"), expected: from || null, role: "sender wallet" };
    }
    case "delivery_ack": {
      // v4.6 — the recipient's signed receipt for a DM. `from` is the acker
      // (the DM's recipient, who signs), `to` is the original sender. Must
      // match buildMessageToSign({ kind: "agent_dm_ack" }) byte-for-byte.
      const from = String(a.from ?? "").toLowerCase();
      const pre = [
        "SIGNA delivery ack v1",
        `ts:${a.ts}`,
        `message:${a.message ?? ""}`,
        `from:${from}`,
        `to:${String(a.to ?? "").toLowerCase()}`,
        `status:${a.status ?? ""}`,
      ].join("\n");
      return { preimage: pre, expected: from || null, role: "recipient wallet (delivery ack)" };
    }
    case "capability": {
      // accept raw output (we hash it) or a precomputed output_hash
      const outHash = a.output_hash ? String(a.output_hash) : sha256(JSON.stringify(a.output ?? null));
      const pre = ["SIGNA capability result v1", `cap:${a.cap ?? ""}`, `input:${a.input ?? ""}`, `provider:${a.provider ?? ""}`, `ts:${a.ts}`, `output:${outHash}`].join("\n");
      return { preimage: pre, expected: GATEWAY, role: "SIGNA capability gateway" };
    }
    case "brain": {
      const ansHash = a.answer_hash ? String(a.answer_hash) : sha256(String(a.answer ?? ""));
      const tools = Array.isArray(a.tools) ? (a.tools as unknown[]).join(",") : String(a.tools ?? "");
      const pre = ["SIGNA brain receipt v1", `ts:${a.ts}`, `goal:${a.goal ?? ""}`, `tools:${tools}`, `answer:${ansHash}`].join("\n");
      return { preimage: pre, expected: BRAIN, role: "SIGNA brain" };
    }
    case "pipeline_link": {
      const pre = ["SIGNA pipeline link v1", `run:${a.runId ?? a.run ?? ""}`, `step:${a.step}`, `cap:${a.cap ?? ""}`, `provider:${String(a.provider ?? "").toLowerCase()}`, `input:${a.input_hash ?? ""}`, `output:${a.output_hash ?? ""}`, `prev:${a.prev ?? ""}`, `ts:${a.ts}`].join("\n");
      return { preimage: pre, expected: GATEWAY, role: "SIGNA capability gateway" };
    }
    case "x402_receipt": {
      // the SIGNA attestor signs a receipt binding request->terms->payment->delivery
      const pre = [
        "SIGNA x402 receipt v1",
        `ts:${a.ts}`,
        `buyer:${String(a.buyer ?? "").toLowerCase()}`,
        `seller:${String(a.seller ?? "").toLowerCase()}`,
        `amount:${a.amount ?? ""}`,
        `asset:${String(a.asset ?? "").toLowerCase()}`,
        `network:${a.network ?? ""}`,
        `request:${a.request_hash ?? ""}`,
        `terms:${a.terms_hash ?? ""}`,
        `payment:${a.payment_hash ?? ""}`,
        `delivery:${a.delivery_hash ?? ""}`,
      ].join("\n");
      return { preimage: pre, expected: X402_ATTESTOR, role: "SIGNA x402 receipt attestor" };
    }
    case "b20_launch": {
      // v8.x — the SIGNA B20 attestor witnesses a B20 token launch (creator +
      // variant + terms + salt + params + predicted address). Must match
      // lib/b20.ts b20LaunchPreimage() byte-for-byte.
      const pre = [
        "SIGNA b20 launch v1",
        `ts:${a.ts}`,
        `creator:${String(a.creator ?? "").toLowerCase()}`,
        `variant:${a.variant ?? ""}`,
        `name:${a.name ?? ""}`,
        `symbol:${a.symbol ?? ""}`,
        `decimals:${a.decimals ?? ""}`,
        `currency:${a.currency ?? ""}`,
        `salt:${a.salt ?? ""}`,
        `params:${a.params_hash ?? ""}`,
        `address:${String(a.address ?? "").toLowerCase()}`,
      ].join("\n");
      return { preimage: pre, expected: B20_LAUNCH, role: "SIGNA B20 launch attestor" };
    }
    case "b20_memo": {
      // v8.x — a B20 transferWithMemo money-note: the PAYER signs a note bound to the
      // transfer; the on-chain memo = keccak256(this preimage). Must match lib/b20.ts
      // b20NotePreimage() byte-for-byte. expected = the payer wallet (`from`).
      const from = String(a.from ?? "").toLowerCase();
      const noteHash = a.note_hash ? String(a.note_hash) : sha256(String(a.note ?? ""));
      const pre = [
        "SIGNA b20 memo v1",
        `ts:${a.ts}`,
        `from:${from}`,
        `to:${String(a.to ?? "").toLowerCase()}`,
        `token:${String(a.token ?? "").toLowerCase()}`,
        `amount:${a.amount ?? ""}`,
        `note:${noteHash}`,
      ].join("\n");
      return { preimage: pre, expected: from || null, role: "payer wallet (b20 money-note)" };
    }
    case "b20_reserves": {
      // v8.x — a B20 stablecoin issuer signs a timestamped reserve attestation
      // ("backed by X of asset Y, as of T"). Must match lib/b20.ts b20ReservesPreimage().
      // expected = the issuer wallet. Provenance of the claim, not a third-party audit.
      const issuer = String(a.issuer ?? "").toLowerCase();
      const stmtHash = a.statement_hash ? String(a.statement_hash) : sha256(String(a.statement ?? ""));
      const pre = [
        "SIGNA b20 reserves v1",
        `ts:${a.ts}`,
        `token:${String(a.token ?? "").toLowerCase()}`,
        `issuer:${issuer}`,
        `reserve:${a.reserve_amount ?? ""} ${a.reserve_asset ?? ""}`,
        `as_of:${a.as_of ?? ""}`,
        `statement:${stmtHash}`,
      ].join("\n");
      return { preimage: pre, expected: issuer || null, role: "stablecoin issuer wallet (reserve attestation)" };
    }
    case "agent_job": {
      // v4.2 — an agent posts a job to the verifiable agent economy: it wallet-signs
      // the brief + bounty. Must match lib/launchpad.ts jobPostPreimage(). expected = poster.
      const poster = String(a.poster ?? "").toLowerCase();
      const briefHash = a.brief_hash ? String(a.brief_hash) : sha256(String(a.brief ?? ""));
      const pre = [
        "SIGNA agent job v1",
        `ts:${a.ts}`,
        `poster:${poster}`,
        `title:${a.title ?? ""}`,
        `brief:${briefHash}`,
        `bounty:${a.bounty ?? ""}`,
        `token:${String(a.token ?? "").toLowerCase()}`,
      ].join("\n");
      return { preimage: pre, expected: poster || null, role: "job poster wallet" };
    }
    case "agent_job_result": {
      // v4.2 — the worker agent delivers and wallet-signs its result for a job.
      // Must match lib/launchpad.ts jobResultPreimage(). expected = worker.
      const worker = String(a.worker ?? "").toLowerCase();
      const resHash = a.result_hash ? String(a.result_hash) : sha256(String(a.result ?? ""));
      const pre = [
        "SIGNA agent job result v1",
        `ts:${a.ts}`,
        `worker:${worker}`,
        `job:${a.job ?? a.job_id ?? ""}`,
        `result:${resHash}`,
      ].join("\n");
      return { preimage: pre, expected: worker || null, role: "job worker wallet" };
    }
    case "deal_offer": {
      // Agent Deals — the buyer signs the exact terms. expected = from (buyer).
      // Must match lib/deals.ts dealOfferPreimage().
      const from = String(a.from ?? "").toLowerCase();
      const pre = [
        "SIGNA deal offer v1",
        `ts:${a.ts}`,
        `from:${from}`,
        `to:${String(a.to ?? "").toLowerCase()}`,
        `task:${a.task ?? ""}`,
        `amount:${a.amount ?? ""}`,
        `asset:${String(a.asset ?? "").toLowerCase()}`,
        `deadline:${a.deadline ?? ""}`,
      ].join("\n");
      return { preimage: pre, expected: from || null, role: "deal buyer wallet" };
    }
    case "deal_accept": {
      // The seller signs the deal_id (= the exact terms). expected = accepter (seller).
      const accepter = String(a.accepter ?? "").toLowerCase();
      const pre = ["SIGNA deal accept v1", `ts:${a.ts}`, `deal:${a.deal ?? ""}`, `accepter:${accepter}`].join("\n");
      return { preimage: pre, expected: accepter || null, role: "deal seller wallet" };
    }
    case "deal_deliver": {
      // The seller signs the result. expected = worker (seller).
      const worker = String(a.worker ?? "").toLowerCase();
      const pre = ["SIGNA deal deliver v1", `ts:${a.ts}`, `deal:${a.deal ?? ""}`, `worker:${worker}`, `result:${a.result ?? ""}`].join("\n");
      return { preimage: pre, expected: worker || null, role: "deal seller wallet" };
    }
    case "deal_settle": {
      // The buyer signs the payment reference. expected = payer (buyer).
      const payer = String(a.payer ?? "").toLowerCase();
      const pre = ["SIGNA deal settle v1", `ts:${a.ts}`, `deal:${a.deal ?? ""}`, `payer:${payer}`, `payment:${a.payment ?? ""}`].join("\n");
      return { preimage: pre, expected: payer || null, role: "deal buyer wallet" };
    }
    case "token_launch": {
      // SignaLaunch — the launcher wallet-signs a receipt for a token they launched.
      // Must match lib/signa-launch.ts launchReceiptPreimage(). expected = launcher.
      const launcher = String(a.launcher ?? "").toLowerCase();
      const pre = [
        "SIGNA token launch v1",
        `ts:${a.ts}`,
        `launcher:${launcher}`,
        `token:${String(a.token ?? "").toLowerCase()}`,
        `name:${a.name ?? ""}`,
        `symbol:${a.symbol ?? ""}`,
        `supply:${a.supply ?? ""}`,
        `chain:${a.chain ?? ""}`,
      ].join("\n");
      return { preimage: pre, expected: launcher || null, role: "token launcher wallet" };
    }
    case "rwa_attestation": {
      // SIGNA Proof-of-Stock — the RWA attestor vouches that a contract is the
      // canonical Robinhood Chain Stock Token for a ticker, and pins its onchain
      // supply at a block. Must match lib/rwa.ts rwaAttestationPreimage()
      // byte-for-byte. Two-leg verification: this recovers the attestor; the
      // caller can independently replay the eth_call at `block`.
      const pre = [
        "SIGNA rwa attestation v1",
        `ts:${a.ts}`,
        `chain:${a.chain ?? ""}`,
        `block:${a.block ?? ""}`,
        `ticker:${String(a.ticker ?? "").toUpperCase()}`,
        `subject:${a.subject ?? ""}`,
        `contract:${String(a.contract ?? "").toLowerCase()}`,
        `canonical:true`,
        `decimals:${a.decimals ?? ""}`,
        `supply:${a.supply ?? ""}`,
        `source:robinhood-chain:erc20`,
      ].join("\n");
      return { preimage: pre, expected: RWA_ATTESTOR, role: "SIGNA RWA attestor (Robinhood Chain Stock Tokens)" };
    }
    case "handle_claim": {
      // v4.x — SIGNA Mail: a wallet claims a human-readable handle (you@signa).
      // Must match lib/mail.ts handleClaimPreimage(). expected = the claiming wallet.
      const address = String(a.address ?? "").toLowerCase();
      const pre = ["SIGNA handle claim v1", `ts:${a.ts}`, `handle:${String(a.handle ?? "").toLowerCase()}`, `address:${address}`].join("\n");
      return { preimage: pre, expected: address || null, role: "handle owner wallet" };
    }
    case "log_checkpoint": {
      // v4.7 — the transparency-log signer signs each Merkle checkpoint over
      // the message layer. Must match transparency.ts checkpointPreimage().
      const pre = [
        "SIGNA log checkpoint v1",
        `seq:${a.seq}`,
        `size:${a.size ?? a.tree_size ?? ""}`,
        `prev:${a.prev ?? a.prev_root ?? ""}`,
        `root:${a.root ?? ""}`,
        `ts:${a.ts}`,
      ].join("\n");
      return { preimage: pre, expected: LOG_SIGNER, role: "SIGNA transparency-log signer" };
    }
    case "aletheia": {
      // v8.0 — SIGNA's verifiable reasoning model signs every answer. Must
      // match brain2.ts aletheiaPreimage().
      const ansHash = a.answer_hash ? String(a.answer_hash) : sha256(String(a.answer ?? ""));
      const tools = Array.isArray(a.tools) ? (a.tools as unknown[]).join(",") : String(a.tools ?? "");
      const pre = ["SIGNA Aletheia answer v1", `ts:${a.ts}`, `goal:${a.goal ?? ""}`, `tools:${tools}`, `answer:${ansHash}`].join("\n");
      return { preimage: pre, expected: ALETHEIA, role: "SIGNA Aletheia model" };
    }
    case "trigger": {
      // v6.0 — the owner signs a conditional automation rule. Must match
      // triggers.ts triggerPreimage().
      const owner = String(a.owner ?? "").toLowerCase();
      const pre = [
        "SIGNA trigger v1",
        `ts:${a.ts}`,
        `owner:${owner}`,
        `when:${a.when_type ?? ""}:${canonObj(a.trigger)}`,
        `do:${a.do_type ?? ""}:${canonObj(a.action)}`,
        `expiry:${a.expiry ?? ""}`,
      ].join("\n");
      return { preimage: pre, expected: owner || null, role: "trigger owner wallet" };
    }
    case "raw": {
      if (typeof a.preimage !== "string") return null;
      return { preimage: a.preimage, expected: a.expected ? String(a.expected).toLowerCase() : null, role: "claimed signer" };
    }
    default:
      return null;
  }
}

export async function verifyArtifact(a: VerifyInput): Promise<VerifyResult> {
  const kind = String(a.kind ?? "").toLowerCase();
  if (!KINDS.includes(kind)) return { ok: false, error: "unknown_kind", kinds: KINDS };
  const sig = String(a.signature ?? "");
  if (!/^0x[0-9a-fA-F]+$/.test(sig)) return { ok: false, error: "missing_or_bad_signature" };

  const built = buildPreimage(a);
  if (!built) return { ok: false, error: kind === "raw" ? "raw_requires_preimage" : "could_not_build_preimage" };

  let recovered: string | null = null;
  try {
    recovered = (await recoverMessageAddress({ message: built.preimage, signature: sig as Hex })).toLowerCase();
  } catch {
    recovered = null;
  }
  const expected = built.expected;
  const matches = expected ? (recovered === expected) : null;
  // "valid" means: signature recovers AND (if we know who should have signed) it's them
  const valid = !!recovered && (expected ? recovered === expected : true);

  return {
    ok: true,
    kind,
    valid,
    recovered,
    expected,
    matches,
    signer_role: built.role,
    preimage: built.preimage,
  };
}

export const VERIFY_KINDS = KINDS;
