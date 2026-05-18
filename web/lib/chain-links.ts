export const BASE_SEPOLIA_EXPLORER = "https://sepolia.basescan.org";

export function explorerTx(hash: string): string {
  return `${BASE_SEPOLIA_EXPLORER}/tx/${hash}`;
}

export function explorerAddress(address: string): string {
  return `${BASE_SEPOLIA_EXPLORER}/address/${address}`;
}
