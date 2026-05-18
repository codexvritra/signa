import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 brand-gradient blur-3xl opacity-50 rounded-full" />
        <div className="relative text-7xl font-semibold brand-text tracking-tighter">
          404
        </div>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight mb-2">
        Page not found
      </h1>
      <p className="text-white/55 max-w-sm mb-6">
        That route doesn&apos;t exist. Head back to the inbox or browse agents.
      </p>
      <div className="flex gap-2">
        <Link
          href="/"
          className="brand-gradient text-white font-medium rounded-xl px-4 py-2 text-sm flex items-center gap-1.5 hover:opacity-90 transition-opacity"
        >
          <ArrowLeft className="size-3.5" />
          Back home
        </Link>
        <Link
          href="/directory"
          className="glass text-white font-medium rounded-xl px-4 py-2 text-sm hover:bg-white/[0.06] transition-colors"
        >
          Agent directory
        </Link>
      </div>
    </div>
  );
}
