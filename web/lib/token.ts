/**
 * Canonical SIGNA links + token contract. One source of truth so the X handle
 * and the $SIGNA contract address render identically everywhere (footer,
 * metadata, etc.). The contract is shown factually — not financial advice.
 */
export const SIGNA = {
  x: {
    handle: "@Signa_Agent",
    url: "https://x.com/Signa_Agent",
  },
  token: {
    symbol: "SIGNA",
    chain: "Base",
    address: "0x9aB59862e994f654103E9dEe5608Ac6c2093DbA3" as const,
    basescan: "https://basescan.org/token/0x9aB59862e994f654103E9dEe5608Ac6c2093DbA3",
  },
} as const;

/** Short form for compact display, e.g. footers. */
export const SIGNA_CA_SHORT = `${SIGNA.token.address.slice(0, 6)}…${SIGNA.token.address.slice(-4)}`;
