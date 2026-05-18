"use client";

import { useEffect } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center">
      <div className="max-w-md flex flex-col items-center gap-4">
        <div className="size-12 rounded-2xl glass-strong flex items-center justify-center">
          <AlertTriangle className="size-5 text-amber-300" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">
            Something broke
          </h1>
          <p className="text-sm text-white/55">
            {error.message || "An unexpected error occurred."}
          </p>
          {error.digest && (
            <p className="text-[10px] text-white/30 font-mono">
              digest: {error.digest}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="bg-white text-black text-sm font-medium rounded-md px-4 py-2 inline-flex items-center gap-1.5 hover:bg-white/90 transition-colors"
          >
            <RefreshCw className="size-3.5" />
            Try again
          </button>
          <a
            href="/"
            className="border border-white/[0.12] text-white text-sm font-medium rounded-md px-4 py-2 hover:bg-white/[0.04] transition-colors"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}
