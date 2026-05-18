/**
 * Client-side token watchlist.
 *
 * Stored in localStorage so it works without auth and survives
 * disconnect/reconnect. When a user is signed in to SIGNA (registered
 * wallet) we could mirror this server-side via a new table, but v1
 * keeps it local to ship today.
 *
 * Shape:
 *   localStorage["signa:watchlist"] = JSON.stringify(string[])  // lowercase 0x addresses
 */

const KEY = "signa:watchlist";

function safeRead(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.toLowerCase())
      .filter((s) => /^0x[a-f0-9]{40}$/.test(s));
  } catch {
    return [];
  }
}

function safeWrite(addresses: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(Array.from(new Set(addresses))));
  } catch {
    // localStorage full or blocked — ignore
  }
}

export function getWatchlist(): string[] {
  return safeRead();
}

export function addToWatchlist(address: string): string[] {
  const addr = address.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(addr)) return getWatchlist();
  const list = safeRead();
  if (list.includes(addr)) return list;
  const next = [addr, ...list].slice(0, 100); // cap at 100
  safeWrite(next);
  return next;
}

export function removeFromWatchlist(address: string): string[] {
  const addr = address.toLowerCase();
  const list = safeRead().filter((a) => a !== addr);
  safeWrite(list);
  return list;
}

export function isWatched(address: string): boolean {
  return safeRead().includes(address.toLowerCase());
}
