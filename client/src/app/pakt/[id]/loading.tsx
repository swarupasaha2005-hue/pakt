import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="flex min-w-0 flex-1 flex-col gap-4">
      <Skeleton className="h-[100px] rounded-2xl" />
      <Skeleton className="h-[240px] rounded-2xl" />
    </main>
  );
}
