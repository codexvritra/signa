export function ConversationSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl p-2.5 flex gap-3 items-center animate-pulse"
        >
          <div className="size-9 rounded-full bg-white/[0.06] flex-shrink-0" />
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div
              className="h-2.5 rounded bg-white/[0.06]"
              style={{ width: `${60 + Math.random() * 30}%` }}
            />
            <div
              className="h-2 rounded bg-white/[0.04]"
              style={{ width: `${40 + Math.random() * 40}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
