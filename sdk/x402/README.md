# signa-x402

**Verifiable receipts for x402 agentic commerce on Base.**

x402 moves the money. It doesn't prove *what was agreed*. `signa-x402` binds the
**request → terms → the x402 payment authorization → the delivery** into one
envelope, signed by the SIGNA attestor and **re-verifiable by anyone on Base** —
no trust in SIGNA. The same check runs locally with `viem`.

> x402 moves the money. SIGNA proves the deal.

- **Zero dependencies** — just `fetch`.
- Works in Node, Bun, Deno, edge runtimes, the browser.
- Non-custodial: SIGNA never settles or holds funds. The receipt is provenance.

## Install

```bash
# from signaagent.xyz — no third-party registry, SHA-256 in /sdk/manifest.json
npm install https://www.signaagent.xyz/sdk/signa-x402-0.1.0.tgz
```

## Add receipts to your x402 server in ~3 lines

After you verify a buyer's x402 payment, issue a receipt and hand it back:

```ts
import { receiptFor } from "signa-x402";

// inside your x402 handler, once the payment is verified + the goods are ready:
const { receipt, url, headers } = await receiptFor({
  request: { item: "market-data snapshot" },     // what was asked
  terms:   { amount, asset, network, payTo },      // your 402 challenge
  payment,                                         // the buyer's EIP-3009 auth + signature
  output,                                          // what you delivered
});

return new Response(JSON.stringify(output), {
  headers: { "content-type": "application/json", ...headers }, // x-signa-receipt: <url>
});
```

That's it. The buyer now has a permanent, verifiable receipt at `url`.

### Express

```ts
import { receiptFor } from "signa-x402";

app.post("/buy", async (req, res) => {
  // ... verify req payment (x402) + produce `output` ...
  const { url, headers } = await receiptFor({ request, terms, payment, output });
  res.set(headers).json({ output, receipt: url });
});
```

### Hono / edge

```ts
const { headers } = await receiptFor({ request, terms, payment, output });
return c.json({ output }, 200, headers);
```

## Re-verify a receipt (anyone, no trust)

```ts
import { getReceipt, verifyReceipt } from "signa-x402";

const receipt = await getReceipt(id);
const v = await verifyReceipt(receipt);
// { valid: true, recovered: "0x…", expected: "0x…(attestor)", matches: true }
```

Or fully offline with `viem` — the attestor signs `receipt.signed_message`:

```ts
import { recoverMessageAddress } from "viem";
const signer = await recoverMessageAddress({
  message: receipt.signed_message,
  signature: receipt.signature,
});
// signer === receipt.signer  →  the receipt is authentic
```

## API

| function | what it does |
| --- | --- |
| `issueReceipt(deal, opts?)` | verify the x402 authorization + sign + store a receipt → `X402Receipt` |
| `receiptFor(deal, opts?)` | `issueReceipt` + return `{ receipt, url, headers }` |
| `getReceipt(id, opts?)` | fetch a receipt by id |
| `verifyReceipt(receipt, opts?)` | re-verify against the universal verifier |
| `receiptUrl(id, opts?)` | the public, in-feed-unfurling permalink |
| `receiptHeaders(receipt, opts?)` | `{ "x-signa-receipt", "x-signa-receipt-id" }` |

`opts`: `{ baseUrl?: string; fetch?: typeof fetch }` — point at your own SIGNA
node, or inject a custom `fetch`.

## How it works

The buyer's payment is an EIP-3009 `TransferWithAuthorization` (the x402 "exact"
scheme). SIGNA verifies that signature recovers to the buyer, then signs a
canonical envelope binding `sha256` of the request, terms, payment, and delivery
plus buyer/seller/amount/asset/network/ts. Pulling the funds is the permissionless
x402 settlement step, done out of band — SIGNA never custodies anything.

Learn more + run a live receipt: <https://www.signaagent.xyz/x402>

MIT.
