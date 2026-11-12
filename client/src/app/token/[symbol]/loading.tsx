import { RightPanel } from "@/components/shell/RightPanel";
import { Skeleton } from "@/components/ui/Skeleton";

/** app shell for client navs while params resolve */
export default function Loading() {
  return (
    <>
      <main className="flex min-w-0 flex-1 flex-col gap-3">
        <Skeleton className="h-12" />
        <Skeleton className="h-[360px]" />
        <Skeleton className="flex-1" />
      </main>
      <RightPanel>
        <Skeleton className="m-4 h-[420px]" />
      </RightPanel>
    </>
  );
}
