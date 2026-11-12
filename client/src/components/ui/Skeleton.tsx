export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-panel-2 ${className}`} />;
}

/** n placeholder rows shaped like a list row: avatar, two lines left, two lines right */
export function RowsSkeleton({ n = 4, className = "" }: { n?: number; className?: string }) {
  return (
    <ul aria-hidden className={`space-y-1 px-1 py-1 ${className}`}>
      {Array.from({ length: n }, (_, i) => (
        <li key={i} className="flex h-[53px] items-center gap-3 p-2">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <span className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-16" />
          </span>
          <span className="flex flex-col items-end gap-1.5">
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-3 w-10" />
          </span>
        </li>
      ))}
    </ul>
  );
}
