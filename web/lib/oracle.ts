/**
 * THE SIGNED ORACLE — the AI that can't delete its calls.
 *
 * Once a day the SIGNA brain makes one binary call on the Base Fear & Greed
 * index, wallet-signs it, and stores it as a signed DM to a dedicated oracle
 * archive address. 24h later it resolves the call against the live signed feed
 * and signs the verdict too. Both records are EIP-191 signatures by the brain
 * wallet — edit or delete one and re-verification breaks. A permanent, public,
 * falsifiable AI track record. This is an accountability experiment, NOT
 * financial advice.
 *
 * Storage reuses the brain-memory pattern (signed DMs), so there is no new
 * table and every call/verdict is re-verifiable on its own.
 */
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes } from "viem";
import { fulfillCapability } from "@/lib/capabilities";

export const ORACLE_METRIC = "Fear & Greed (Base / crypto sentiment)";
export const WINDOW_SEC = 24 * 60 * 60;

const brain = privateKeyToAccount(keccak256(toBytes("signa:brain:v1")));
export const ORACLE_ADDR = privateKeyToAccount(keccak256(toBytes("signa:oracle:v1"))).address.toLowerCase();
export const BRAIN_ADDR = brain.address.toLowerCase();

export type OracleCall = {
  id: string;
  asof: number;
  at: number;
  call: "UP" | "DOWN";
  resolve_after: number;
  thesis: string;
  signature?: string;
  resolved?: { resolved_at: number; final: number; outcome: "UP" | "DOWN"; hit: boolean; signature?: string };
};

function dmPreimage(from: string, to: string, body: string, ts: number) {
  return ["SIGNA agent dm v1", `ts:${ts}`, `from:${from.toLowerCase()}`, `to:${to.toLowerCase()}`, `body:${body}`].join("\n");
}

async function brainPost(origin: string, body: string): Promise<string | null> {
  const ts = Date.now();
  const signature = await brain.signMessage({ message: dmPreimage(BRAIN_ADDR, ORACLE_ADDR, body, ts) });
  try {
    const r = await fetch(`${origin}/api/agents/${BRAIN_ADDR}/dm`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: BRAIN_ADDR, to: ORACLE_ADDR, body, ts, signature }),
    });
    const j = await r.json().catch(() => ({}));
    return j?.dm?.id ?? null;
  } catch { return null; }
}

function kv(body: string): Record<string, string> {
  const o: Record<string, string> = {};
  for (const line of body.split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) o[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return o;
}

async function feargreed(): Promise<number | null> {
  try {
    const out = (await fulfillCapability("root.feargreed", "")) as { score?: number };
    const s = Number(out?.score);
    return Number.isFinite(s) ? s : null;
  } catch { return null; }
}

async function reasonDirection(origin: string, score: number, label: string): Promise<{ call: "UP" | "DOWN"; thesis: string }> {
  const prompt =
    `The crypto Fear & Greed index is at ${score} (${label}). In the next 24 hours, will it be HIGHER or LOWER? ` +
    `Reply with exactly one word UP or DOWN, then a dash and one short reason (max 14 words).`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(`${origin}/api/gateway/respond`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt }), signal: ctrl.signal,
    });
    clearTimeout(t);
    const j = await r.json().catch(() => ({}));
    const txt = String(j?.response ?? "").trim();
    const m = txt.match(/\b(UP|DOWN)\b/i);
    if (m) {
      const call = m[1].toUpperCase() as "UP" | "DOWN";
      const thesis = txt.replace(/^[^a-zA-Z]*\b(UP|DOWN)\b[\s:–-]*/i, "").slice(0, 120).trim() || `the brain calls it ${call.toLowerCase()}`;
      return { call, thesis };
    }
  } catch { /* fall through */ }
  // documented fallback: mean-reversion on extremes
  const call: "UP" | "DOWN" = score >= 55 ? "DOWN" : score <= 45 ? "UP" : "UP";
  return { call, thesis: `mean-reversion read at ${label.toLowerCase()} ${score}` };
}

/** Read every signed oracle record from the archive, pair calls with verdicts. */
export async function readCalls(origin: string): Promise<OracleCall[]> {
  let dms: Array<{ from?: string; from_address?: string; body?: string; signature?: string }> = [];
  try {
    const j = await (await fetch(`${origin}/api/agents/${ORACLE_ADDR}/inbox?from=${BRAIN_ADDR}&limit=200`, { cache: "no-store" })).json();
    dms = j?.dms ?? j?.inbox ?? [];
  } catch { /* */ }
  const calls = new Map<string, OracleCall>();
  const resolves: Array<{ ref: string; resolved_at: number; final: number; outcome: "UP" | "DOWN"; hit: boolean; signature?: string }> = [];
  for (const dm of dms) {
    const from = (dm.from ?? dm.from_address ?? "").toLowerCase();
    if (from !== BRAIN_ADDR) continue;
    const body = dm.body ?? "";
    if (body.startsWith("SIGNA oracle call v1")) {
      const k = kv(body);
      if (k.id) calls.set(k.id, { id: k.id, asof: Number(k.asof), at: Number(k.at), call: (k.call === "DOWN" ? "DOWN" : "UP"), resolve_after: Number(k.resolve_after), thesis: k.thesis ?? "", signature: dm.signature });
    } else if (body.startsWith("SIGNA oracle resolve v1")) {
      const k = kv(body);
      if (k.ref) resolves.push({ ref: k.ref, resolved_at: Number(k.resolved_at), final: Number(k.final), outcome: (k.outcome === "DOWN" ? "DOWN" : "UP"), hit: k.hit === "true", signature: dm.signature });
    }
  }
  for (const r of resolves) {
    const c = calls.get(r.ref);
    if (c) c.resolved = { resolved_at: r.resolved_at, final: r.final, outcome: r.outcome, hit: r.hit, signature: r.signature };
  }
  return [...calls.values()].sort((a, b) => b.asof - a.asof);
}

/** Resolve any matured open call + open a new one if none is live. Idempotent-ish. */
export async function tick(origin: string): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const calls = await readCalls(origin);
  const latest = calls[0];

  // 1) resolve a matured, unresolved call
  if (latest && !latest.resolved && nowSec >= latest.resolve_after) {
    const final = await feargreed();
    if (final != null) {
      const outcome: "UP" | "DOWN" = final > latest.at ? "UP" : "DOWN";
      const hit = outcome === latest.call;
      await brainPost(origin, ["SIGNA oracle resolve v1", `ref:${latest.id}`, `resolved_at:${nowSec}`, `final:${final}`, `outcome:${outcome}`, `hit:${hit}`].join("\n"));
    }
  }

  // 2) open a new call if there's no live (unmatured) one — guard against dupes
  const live = calls.find((c) => c.resolve_after > nowSec);
  const tooRecent = calls.some((c) => nowSec - c.asof < WINDOW_SEC - 3600);
  if (!live && !tooRecent) {
    const score = await feargreed();
    if (score != null) {
      const label = score >= 75 ? "Extreme Greed" : score >= 55 ? "Greed" : score >= 45 ? "Neutral" : score >= 25 ? "Fear" : "Extreme Fear";
      const { call, thesis } = await reasonDirection(origin, score, label);
      await brainPost(origin, ["SIGNA oracle call v1", `id:${nowSec}`, `metric:feargreed`, `asof:${nowSec}`, `at:${score}`, `call:${call}`, `resolve_after:${nowSec + WINDOW_SEC}`, `thesis:${thesis}`].join("\n"));
    }
  }
}

export function scoreboard(calls: OracleCall[]) {
  const resolved = calls.filter((c) => c.resolved);
  const hits = resolved.filter((c) => c.resolved!.hit).length;
  // current streak from most-recent resolved backwards
  let streak = 0, streakHit = resolved[0]?.resolved?.hit;
  for (const c of resolved) {
    if (c.resolved!.hit === streakHit) streak++;
    else break;
  }
  return {
    total: calls.length,
    resolved: resolved.length,
    hits,
    misses: resolved.length - hits,
    hit_rate: resolved.length ? Math.round((hits / resolved.length) * 100) : null,
    open: calls.filter((c) => !c.resolved).length,
    streak: resolved.length ? { kind: streakHit ? "W" : "L", n: streak } : null,
  };
}
