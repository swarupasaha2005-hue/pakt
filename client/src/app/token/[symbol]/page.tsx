import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Positions } from "@/components/home/Positions";
import { RightPanel } from "@/components/shell/RightPanel";
import { AboutCard } from "@/components/token/AboutCard";
import { ChartPanel } from "@/components/token/ChartPanel";
import { HoldersTable } from "@/components/token/HoldersTable";
import { TokenHeader } from "@/components/token/TokenHeader";
import { TradePanel } from "@/components/token/TradePanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { tokens } from "@/lib/mock/tokens";

export const generateStaticParams = () => tokens.map((t) => ({ symbol: t.symbol }));

export default async function TokenPage({ params }: PageProps<"/token/[symbol]">) {
  const { symbol } = await params;
  const token = tokens.find((t) => t.symbol === symbol);
  if (!token) notFound();

  return (
    <>
      <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto">
        <TokenHeader token={token} />
        <ChartPanel token={token} />
        <HoldersTable token={token} />
      </main>
      <RightPanel>
        {/* why: TradePanel reads ?amount= from quick buy */}
        <Suspense fallback={<Skeleton className="m-4 h-[420px]" />}>
          <TradePanel token={token} />
        </Suspense>
        <AboutCard token={token} />
        <Positions symbol={token.symbol} />
      </RightPanel>
    </>
  );
}
