"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { leaderboard, type Range } from "@/lib/api";
import { loadPakts, paktName, useLoad, usdNum } from "@/lib/home/data";
import { useWallet } from "@/lib/near/wallet";
import { PaktGrid } from "./leaderboard/PaktGrid";
import { TraderRow } from "./leaderboard/TraderRow";
import { YourRank } from "./leaderboard/YourRank";

const RANGES = { "7D": "7d", "30D": "30d", ALL: "all" } as const satisfies Record<string, Range>;
type RangeLabel = keyof typeof RANGES;

export function LeaderboardTab() {
  const { accountId } = useWallet();
  const [range, setRange] = useState<RangeLabel>("7D");
  const { data, error } = useLoad(() => leaderboard({ range: RANGES[range], limit: 100 }), [range]);
  const pakts = useLoad(loadPakts, []);

  const board = data?.traders.items ?? [];
  const mine = board.findIndex((t) => t.trader === accountId);
  const paktNames = (account: string) => pakts.data?.filter((p) => p.trader?.account === account).map((p) => p.name) ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      <PaktGrid pakts={data?.pakts.items.slice(0, 6).map((p) => ({ name: paktName(p.vault), change: p.change }))} />
      <div className="flex items-center justify-between px-3 pt-2.5">
        <span className="text-sm">Traders</span>
        <Segmented options={Object.keys(RANGES) as RangeLabel[]} value={range} onChange={setRange} />
      </div>
      {accountId && <YourRank account={accountId} rank={mine < 0 ? undefined : mine + 1} pnl={mine < 0 ? undefined : usdNum(board[mine].pnl)} />}
      {!data && !error && (
        <div className="space-y-2 px-3 py-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
        </div>
      )}
      {error && <p className="py-10 text-center text-sm text-text-2">Could not load the leaderboard</p>}
      {data && !board.length && <p className="py-10 text-center text-sm text-text-2">No traders yet</p>}
      <ol className="px-3 py-1">
        {board.map((t, i) => (
          <TraderRow key={t.trader} trader={t} rank={i + 1} paktNames={paktNames(t.trader)} />
        ))}
      </ol>
    </div>
  );
}
