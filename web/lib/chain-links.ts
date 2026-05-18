export const BASE_EXPLORER = "https://basescan.org";

export function explorerTx(hash: string): string {
  return `${BASE_EXPLORER}/tx/${hash}`;
}

export function explorerAddress(address: string): string {
  return `${BASE_EXPLORER}/address/${address}`;
}
