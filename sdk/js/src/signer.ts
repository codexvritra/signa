/**
 * v4.9 — custody-delegated signing.
 *
 * SIGDA's model is "the wallet is the credential": agents sign EIP-191
 * messages, EIP-3009 payment authorizations, and log/checkpoint preimages.
 * The one soft spot is *where the private key lives*. This module lets the key
 * live in an external HSM/TEE custody service (1Claw, Turnkey, Privy, AWS KMS,
 * …) instead of in the agent process — the agent submits a preimage, the
 * custody service signs it, SIGDA posts the signature. The raw key never
 * touches the agent.
 *
 * `SigdaSigner` is the structural seam SIGDA needs (a viem `PrivateKeyAccount`
 * already satisfies it, so nothing else changes). `remoteSigner` builds one
 * from any async sign function. `oneClawSigner` is a ready 1Claw Intents-API
 * implementation built on top.
 */
import { toAccount } from "viem/accounts";
import { hashMessage, hashTypedData, type Hex } from "viem";

/**
 * The minimal signer SIGDA uses everywhere. A viem `PrivateKeyAccount`
 * satisfies it (local key); a custody-backed account satisfies it too.
 */
export interface SigdaSigner {
  address: Hex;
  signMessage(args: { message: string | { raw: Hex } }): Promise<Hex>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signTypedData(args: any): Promise<Hex>;
}

/**
 * Build a SIGDA-compatible account from a remote/custodied signer. You supply
 * `address` (the wallet the custody service controls) and `sign(payload)`,
 * which receives either a 32-byte EIP-191 message hash or a 32-byte EIP-712
 * digest and returns the 65-byte signature. The agent never holds the key.
 *
 * ```ts
 * const account = remoteSigner({
 *   address: "0x…",
 *   sign: async ({ hash }) => myHsm.signDigest(hash), // returns 0x…65-byte sig
 * });
 * const agent = new SigdaAgent({ account });
 * ```
 */
export function remoteSigner(opts: {
  address: Hex;
  sign: (payload: { hash: Hex; kind: "message" | "typedData" }) => Promise<Hex>;
}): SigdaSigner {
  const account = toAccount({
    address: opts.address,
    async signMessage({ message }) {
      return opts.sign({ hash: hashMessage(message), kind: "message" });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async signTypedData(typedData: any) {
      return opts.sign({ hash: hashTypedData(typedData), kind: "typedData" });
    },
    async signTransaction() {
      throw new Error("remoteSigner: signTransaction is not used by SIGDA (messages + EIP-3009 only)");
    },
  });
  return account as unknown as SigdaSigner;
}

/**
 * 1Claw custody signer. The private key stays in 1Claw's HSM/TEE; SIGDA submits
 * the preimage hash as an Intent and 1Claw returns the signature. Point a SIGDA
 * agent at it with `new SigdaAgent({ account: oneClawSigner({...}) })`.
 *
 * The Intents API wire shape is configurable (`endpoint` + `request`/`parse`)
 * so it tracks 1Claw's API exactly without code changes; the defaults target
 * `POST {baseUrl}/v1/intents/sign` with a Bearer token, sending
 * `{ key_id, hash, type }` and reading `{ signature }`. Confirm the live shape
 * against 1Claw's docs and override if needed.
 *
 * `apiKey` is the 1Claw API token (or a short-lived JWT). It authenticates to
 * 1Claw — it is NOT the signing key and never leaves your process boundary
 * except as a Bearer header to 1Claw.
 */
export function oneClawSigner(opts: {
  address: Hex;
  apiKey: string;
  keyId: string;
  baseUrl?: string;
  /** Override the request body sent to the Intents API. */
  request?: (p: { keyId: string; hash: Hex; kind: "message" | "typedData" }) => unknown;
  /** Override how the signature is read out of the response. */
  parse?: (json: unknown) => string;
  /** Override the endpoint path (default /v1/intents/sign). */
  endpoint?: string;
  fetchImpl?: typeof fetch;
}): SigdaSigner {
  const baseUrl = (opts.baseUrl ?? "https://api.1claw.xyz").replace(/\/$/, "");
  const path = opts.endpoint ?? "/v1/intents/sign";
  const doFetch = opts.fetchImpl ?? fetch;

  return remoteSigner({
    address: opts.address,
    sign: async ({ hash, kind }) => {
      const body =
        opts.request?.({ keyId: opts.keyId, hash, kind }) ??
        { key_id: opts.keyId, hash, type: kind === "message" ? "eip191_digest" : "eip712_digest" };
      const r = await doFetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify(body),
      });
      const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) {
        throw new Error(`oneClawSigner: 1Claw Intents API ${r.status} ${JSON.stringify(json).slice(0, 160)}`);
      }
      const sig = opts.parse?.(json) ?? (json.signature as string) ?? (json.sig as string);
      if (typeof sig !== "string" || !sig.startsWith("0x")) {
        throw new Error("oneClawSigner: no signature in 1Claw response (override `parse` to match the API)");
      }
      return sig as Hex;
    },
  });
}
