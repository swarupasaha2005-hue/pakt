import { Skeleton } from "@/components/ui/Skeleton";

// why: params is URL data, instant nav needs a shell to show while it resolves
export default function Loading() {
  return (
    <main className="flex min-w-0 flex-1 flex-col gap-3">
      <Skeleton className="h-[120px]" />
      <Skeleton className="h-[72px] w-80" />
    </main>
  );
}
