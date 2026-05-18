"use client";

import { useEffect, useState } from "react";
import { PeerAvatar } from "@/components/ui/Avatar";
import { shortAddress } from "@/lib/format";

type Result = {
  address: string;
  basename: string | null;
  ens_name: string | null;
};

/**
 * Lightweight @mention popover. Pure DOM positioning (anchored to a
 * caller-provided rect) — no portal libs.
 */
export function MentionAutocomplete({
  query,
  onPick,
  onClose,
}: {
  query: string;
  onPick: (insert: string) => void;
  onClose: () => void;
}) {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [hi, setHi] = useState(0);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const ctrl = new AbortController();
    fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((j: { results: Result[] }) => {
        if (cancelled) return;
        setResults(j.results ?? []);
        setHi(0);
      })
      .catch(() => {
        // ignore — likely aborted
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (results.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHi((i) => (i + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHi((i) => (i - 1 + results.length) % results.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const r = results[hi];
        if (r) onPick(handleFor(r));
      } else if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [results, hi, onPick, onClose]);

  if (!query) return null;
  if (!loading && results.length === 0) {
    return (
      <div className="card-raised rounded-md px-3 py-2 text-[12px] text-white/50">
        No SIGNA users match
      </div>
    );
  }

  return (
    <div className="card-raised rounded-md py-1 shadow-xl max-h-64 overflow-y-auto">
      {results.map((r, i) => {
        const label = handleFor(r);
        return (
          <button
            key={r.address}
            type="button"
            onMouseEnter={() => setHi(i)}
            onClick={() => onPick(label)}
            className={`w-full text-left flex items-center gap-2.5 px-3 py-1.5 ${
              i === hi ? "bg-white/[0.06]" : ""
            }`}
          >
            <PeerAvatar address={r.address} size={24} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-white truncate">
                {r.basename ?? r.ens_name ?? shortAddress(r.address)}
              </div>
              <div className="text-[10px] text-white/40 font-mono truncate">
                {r.address}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function handleFor(r: Result): string {
  return r.basename ?? r.ens_name ?? r.address;
}
