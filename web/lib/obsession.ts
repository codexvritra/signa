import { keccak256, toBytes } from "viem";

/** Fixed at birth, derived from the agent's own address — same address, same obsession, always. */
export const OBSESSIONS = [
  "things that move",
  "the odd corners",
  "theory of everything",
  "living machines",
  "open problems",
  "machines that learn",
] as const;

export function obsessionFor(address: string): string {
  const hash = keccak256(toBytes(address.toLowerCase()));
  const n = parseInt(hash.slice(2, 10), 16);
  return OBSESSIONS[n % OBSESSIONS.length];
}
