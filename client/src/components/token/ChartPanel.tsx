"use client";

import { useEffect, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import type { TokenInfo } from "@/lib/config";
import { FRAMES, loadCandles, PAIRS, type Candle, type Frame } from "@/lib/token/data";
import { Chart } from "./Chart";

const REFRESH_MS = 30_000;

/** mainnet candles of the pair the test token tracks; refreshed every 30s */
export function ChartPanel({ token }: { token: TokenInfo }) {
  const pair = PAIRS[token.symbol];
  const [frame, setFrame] = useState<Frame>("1h");
  const [got, setGot] = useState<{ key: string; candles: Candle[] | null }>({ key: "", candles: null });
  const key = `${pair}/${frame}`;

  useEffect(() => {
    if (!pair) return;
    let live = true;
    const load = () => loadCandles(pair, frame).then((candles) => live && setGot({ key, candles }), () => live && setGot((g) => (g.key === key ? g : { key, candles: null }))); // keep last good candles on a failed refresh
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { live = false; clearInterval(t); };
  }, [pair, frame, key]);

  const candles = got.key === key ? got.candles : undefined; // undefined = loading, null = failed

  return (
    <section className="shrink-0">
      {!pair ? (
        <Empty>No mainnet price for {token.symbol}</Empty>
      ) : candles === undefined ? (
        <Skeleton className="h-[360px]" />
      ) : !candles?.length ? (
        <Empty>Could not load {pair} candles</Empty>
      ) : (
        <Chart key={key} label={`${pair} · ${frame}`} candles={candles} />
      )}
      <div className="flex h-10 items-center justify-between gap-2 border-b px-2 text-xs text-text-2">
        <Segmented pill options={Object.keys(FRAMES) as Frame[]} value={frame} onChange={setFrame} />
        <span className="truncate">mainnet {pair ?? "-"} spot candles · Coinbase</span>
      </div>
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-[360px] items-center justify-center text-sm text-text-2">{children}</div>
);
