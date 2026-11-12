"use client";

import Link from "next/link";
import { useState } from "react";
import { RightPanel } from "@/components/shell/RightPanel";
import { loadPakts, loadTokens, prices, useLoad, useNow } from "@/lib/home/data";
import { useStream } from "@/lib/stream";
import { bySymbol, getPool, holdersOf, loadStats, loadTrades, PAIRS, touches, type TradeEvent } from "@/lib/token/data";
import { AboutCard } from "./AboutCard";
import { ChartPanel } from "./ChartPanel";
import { HoldersTable } from "./HoldersTable";
import { TokenHeader } from "./TokenHeader";
import { TradeHintCard } from "./TradeHintCard";

/** token page center + right: oracle price, ref pool, pakt holdings and indexed trades */
export function TokenView({ symbol }: { symbol: string }) {
  const info = bySymbol(symbol);
  const id = info?.id ?? null;
  const now = useNow();
  const tokens = useLoad(loadTokens, []);
  const oracle = useLoad(prices, []);
  const pakts = useLoad(loadPakts, []);
  const pool = useLoad(info?.pool != null ? () => getPool(info.pool!) : null, [info?.pool]);
  const loaded = useLoad(id ? () => loadTrades(id) : null, [id]);
  const pair = info && PAIRS[info.symbol];
  const market = useLoad(pair ? () => loadStats(pair) : null, [pair]);
  const [live, setLive] = useState<TradeEvent[]>([]);

  useStream((e) => {
    if (id && touches(e, id)) setLive((l) => (l.some((x) => x.id === e.id) ? l : [e, ...l]));
  });

  if (!info || !id) {
    return (
      <main className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-xl font-bold">No token “{symbol}”</h1>
        <p className="text-xs text-text-2">Pakts trade only the whitelisted tokens.</p>
        <Link href="/" className="text-xs font-bold text-accent hover:underline">
          Back to Explore
        </Link>
      </main>
    );
  }

  const t = tokens.data?.find((x) => x.id === id);
  const price = t ? t.price : undefined;
  const trades = loaded.data && [...live.filter((e) => !loaded.data!.some((x) => x.id === e.id)), ...loaded.data];
  const held = pakts.data && holdersOf(id, pakts.data);

  return (
    <>
      <main className="flex min-w-0 flex-1 flex-col gap-3 md:overflow-y-auto">
        <TokenHeader token={info} logo={t?.logo} price={price} stats={market.data} />
        <ChartPanel token={info} />
        <HoldersTable token={info} held={held} trades={trades} now={now} />
      </main>
      <RightPanel>
        <TradeHintCard symbol={info.symbol} pakts={held?.map((h) => h.pakt)} />
        <AboutCard token={info} pool={info.pool === null ? null : pool.data} poolError={!!pool.error} oracle={oracle.data} now={now} stats={market.data} />
      </RightPanel>
    </>
  );
}
