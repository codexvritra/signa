"use client";

import { useState } from "react";
import { useAccount, useSendTransaction } from "wagmi";

type LaunchResp = {
  ok: boolean; error?: string;
  network?: string; factory?: string; predicted_address?: string | null;
  tx?: { to: string; data: string; value: string };
  salt?: string;
  receipt?: {
    ts: number; creator: string; variant: string; name: string; symbol: string;
    decimals: number | null; currency: string | null; salt: string; params_hash: string;
    address: string | null; signer: string; signature: string; signed_message: string;
    reverify: Record<string, unknown>;
  };
};

const short = (s?: string | null, n = 10) => (s ? (s.length > 2 * n ? `${s.slice(0, n)}…${s.slice(-6)}` : s) : "—");

export default function B20Page() {
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();

  const [variant, setVariant] = useState<"ASSET" | "STABLECOIN">("ASSET");
  const [name, setName] = useState("Signa Agent Token");
  const [symbol, setSymbol] = useState("SAT");
  const [decimals, setDecimals] = useState(18);
  const [currency, setCurrency] = useState("USD");
  const [creator, setCreator] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<LaunchResp | null>(null);
  const [verify, setVerify] = useState<{ valid: boolean; recovered: string; role: string } | null>(null);
  const [minted, setMinted] = useState<string | null>(null);

  // lookup
  const [lookAddr, setLookAddr] = useState("");
  const [look, setLook] = useState<Record<string, unknown> | null>(null);
  const [lookBusy, setLookBusy] = useState(false);

  const creatorAddr = (creator.trim() || address || "").toLowerCase();

  async function prepare() {
    if (busy) return;
    if (!/^0x[a-f0-9]{40}$/.test(creatorAddr)) { setRes({ ok: false, error: "Connect a wallet or paste a creator address (0x…40)." }); return; }
    setBusy(true); setRes(null); setVerify(null); setMinted(null);
    try {
      const r = await fetch("/api/b20", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ variant, name: name.trim(), symbol: symbol.trim(), creator: creatorAddr, decimals, currency }),
      });
      setRes(await r.json());
    } catch (e) { setRes({ ok: false, error: e instanceof Error ? e.message : "failed" }); }
    setBusy(false);
  }

  async function doVerify() {
    if (!res?.receipt?.reverify) return;
    try {
      const r = await fetch("/api/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(res.receipt.reverify) });
      const j = await r.json();
      setVerify({ valid: !!j.valid, recovered: j.recovered, role: j.signer_role });
    } catch {}
  }

  async function mint() {
    if (!res?.tx) return;
    try {
      const hash = await sendTransactionAsync({ to: res.tx.to as `0x${string}`, data: res.tx.data as `0x${string}`, value: BigInt(res.tx.value || "0") });
      setMinted(hash);
    } catch (e) { setMinted(`error: ${e instanceof Error ? e.message.slice(0, 80) : "rejected"}`); }
  }

  async function lookup() {
    const a = lookAddr.trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(a)) { setLook({ error: "paste a token address (0x…40)" }); return; }
    setLookBusy(true); setLook(null);
    try { setLook(await (await fetch(`/api/b20?address=${a}`)).json()); } catch (e) { setLook({ error: e instanceof Error ? e.message : "failed" }); }
    setLookBusy(false);
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[920px] mx-auto px-5 py-10 sm:py-14">
        {/* hero */}
        <div className="text-[12px] uppercase tracking-[0.2em] text-[#5ee68f] font-semibold">Base · B20 — the new native token standard</div>
        <h1 className="text-[46px] sm:text-[64px] font-bold leading-[0.98] mt-2 tracking-tight">
          <span className="bg-gradient-to-r from-[#6ea2ff] to-[#a98bff] bg-clip-text text-transparent">B20</span> × SIGNA
        </h1>
        <p className="text-[19px] mt-4 max-w-[680px] leading-relaxed text-muted">
          B20 is Base&apos;s chain-native token standard — ~50% cheaper transfers, far cheaper creation.
          SIGNA makes every B20 launch <span className="text-white">verifiable</span>:
          your wallet mints the token, and SIGNA wallet-signs a receipt anyone can re-check.
        </p>
        <p className="text-[14px] mt-3 text-faint">x402 moved the money. B20 mints the token. <span className="text-[#a5c3ff]">SIGNA proves who launched what.</span></p>

        {/* launch lab */}
        <div className="mt-8 glass-strong rounded-2xl p-5 sm:p-6">
          <div className="text-[12px] uppercase tracking-wider text-[#a5c3ff] font-semibold mb-3">Verifiable B20 launch</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-[12px] text-faint">Token name
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[14px] text-white outline-none focus:border-[#6ea2ff]/60" />
            </label>
            <label className="text-[12px] text-faint">Symbol
              <input value={symbol} onChange={(e) => setSymbol(e.target.value)} className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[14px] text-white outline-none focus:border-[#6ea2ff]/60" />
            </label>
            <label className="text-[12px] text-faint">Variant
              <select value={variant} onChange={(e) => setVariant(e.target.value as "ASSET" | "STABLECOIN")} className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[14px] text-white outline-none focus:border-[#6ea2ff]/60">
                <option value="ASSET">Asset</option>
                <option value="STABLECOIN">Stablecoin</option>
              </select>
            </label>
            {variant === "ASSET" ? (
              <label className="text-[12px] text-faint">Decimals (6–18)
                <input type="number" min={6} max={18} value={decimals} onChange={(e) => setDecimals(Number(e.target.value))} className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[14px] text-white outline-none focus:border-[#6ea2ff]/60" />
              </label>
            ) : (
              <label className="text-[12px] text-faint">Currency (e.g. USD)
                <input value={currency} onChange={(e) => setCurrency(e.target.value)} className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[14px] text-white outline-none focus:border-[#6ea2ff]/60" />
              </label>
            )}
            <label className="text-[12px] text-faint sm:col-span-2">Creator wallet (owns the token) {address ? "— connected" : "— paste 0x…"}
              <input value={creator} onChange={(e) => setCreator(e.target.value)} placeholder={address ?? "0x…"} className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[13px] font-mono text-white outline-none focus:border-[#6ea2ff]/60" />
            </label>
          </div>
          <button onClick={prepare} disabled={busy} className="mt-4 px-5 py-2.5 rounded-xl font-semibold text-[15px] bg-gradient-to-r from-[#3b6fe0] to-[#8b5cf6] text-white disabled:opacity-60 hover:brightness-110 transition">
            {busy ? "Preparing…" : "Prepare verifiable launch →"}
          </button>

          {res && !res.ok && <div className="mt-4 text-[13px] text-[#ff8f8f]">{res.error}</div>}

          {res?.ok && res.receipt && (
            <div className="mt-5 space-y-3">
              <div className="border border-white/[0.08] bg-black/20 rounded-lg p-4 text-[13px] font-mono">
                <div className="text-faint">predicted address</div>
                <div className="text-[#6ea2ff] break-all">{res.predicted_address ?? "(needs a Beryl-aware RPC — bound on broadcast)"}</div>
                <div className="text-faint mt-2">createB20 calldata → {short(res.tx?.to)}</div>
                <div className="text-muted break-all">{short(res.tx?.data, 26)}</div>
              </div>
              <div className="border border-[#5ee68f]/30 bg-[#22c98a]/[0.08] rounded-lg p-4">
                <div className="text-[11px] uppercase tracking-wider text-[#5ee68f] font-semibold mb-1">Signed launch receipt</div>
                <div className="text-[13px] text-muted">{res.receipt.name} ({res.receipt.symbol}) · {res.receipt.variant}{res.receipt.decimals != null ? ` · ${res.receipt.decimals}d` : ""}{res.receipt.currency ? ` · ${res.receipt.currency}` : ""}</div>
                <div className="text-[11px] text-faint mt-2 font-mono break-all">signer {short(res.receipt.signer)} · sig {short(res.receipt.signature, 20)}</div>
                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <button onClick={doVerify} className="text-[12px] px-3 py-1 rounded bg-white/[0.06] text-[#a5c3ff] hover:bg-white/[0.12]">Verify this receipt</button>
                  <button onClick={mint} className="text-[12px] px-3 py-1 rounded bg-white/[0.06] text-[#5ee68f] hover:bg-white/[0.12]">Mint on Base (your wallet)</button>
                  {verify && <span className={`text-[12px] ${verify.valid ? "text-[#5ee68f]" : "text-[#ff8f8f]"}`}>{verify.valid ? `✓ valid — recovers to ${short(verify.recovered, 8)} (${verify.role})` : "✗ invalid"}</span>}
                </div>
                {minted && <div className="text-[11px] text-faint mt-2 font-mono break-all">{minted.startsWith("error") ? minted : `broadcast tx ${minted}`}</div>}
              </div>
            </div>
          )}
        </div>

        {/* lookup */}
        <div className="mt-6 glass rounded-2xl p-5">
          <div className="text-[12px] uppercase tracking-wider text-[#a5c3ff] font-semibold mb-2">Look up a B20 token</div>
          <div className="flex gap-2">
            <input value={lookAddr} onChange={(e) => setLookAddr(e.target.value)} placeholder="0x… token address" className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[13px] font-mono text-white outline-none focus:border-[#6ea2ff]/60" />
            <button onClick={lookup} disabled={lookBusy} className="px-4 py-2 rounded-lg bg-white/[0.06] text-[#a5c3ff] text-[13px] hover:bg-white/[0.12] disabled:opacity-60">{lookBusy ? "…" : "Look up"}</button>
          </div>
          {look && (
            <pre className="mt-3 text-[12px] text-muted bg-black/20 border border-white/[0.06] rounded-lg p-3 overflow-x-auto">{JSON.stringify(look, null, 2)}</pre>
          )}
        </div>

        {/* how it works */}
        <h2 className="text-[18px] font-bold mt-12 mb-3">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            ["1 · Your wallet mints", "SIGNA builds the exact createB20 calldata; you broadcast it. SIGNA never custodies funds.", "#6ea2ff"],
            ["2 · SIGNA signs a receipt", "A wallet-signed envelope binds creator + terms + salt + params + the deterministic address.", "#5ee68f"],
            ["3 · Anyone verifies", "Re-check at /api/verify (kind b20_launch) — recovers the SIGNA B20 attestor. No trust needed.", "#a98bff"],
          ].map(([h, d, c]) => (
            <div key={h} className="glass rounded-xl p-4">
              <div className="text-[14px] font-bold" style={{ color: c }}>{h}</div>
              <div className="text-[12.5px] text-muted mt-1.5 leading-relaxed">{d}</div>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-faint mt-6 leading-relaxed">
          Honest scope: B20 launched with Base&apos;s Beryl upgrade. SIGNA proves launches and reads B20 tokens (ERC-20 compatible);
          the actual mint is broadcast by your own wallet, and on-chain reads need a Beryl-aware RPC. The signed receipt + verification work offline today.
          API: <span className="font-mono">POST /api/b20</span> · re-verify at <a className="text-[#a5c3ff] hover:underline" href="/verify">/verify</a> (kind <span className="font-mono">b20_launch</span>). Also in Claude via <span className="font-mono">signa_b20_launch</span>.
        </p>
      </div>
    </div>
  );
}
