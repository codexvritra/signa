"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RepLookup() {
  const [v, setV] = useState("");
  const router = useRouter();
  const go = () => {
    const a = v.trim();
    if (/^0x[a-fA-F0-9]{40}$/.test(a)) router.push(`/reputation/${a.toLowerCase()}`);
  };
  const valid = /^0x[a-fA-F0-9]{40}$/.test(v.trim());
  return (
    <div className="flex gap-2 flex-wrap">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && go()}
        placeholder="0x… agent address"
        spellCheck={false}
        className="flex-1 min-w-[260px] h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.1] text-[14px] font-mono outline-none focus:border-[#5b8def]"
      />
      <button
        onClick={go}
        disabled={!valid}
        className="h-11 px-5 rounded-xl font-semibold text-white text-[14px] bg-gradient-to-br from-[#5b8def] to-[#8b5cf6] disabled:opacity-40 shrink-0"
      >
        Check reputation
      </button>
    </div>
  );
}
