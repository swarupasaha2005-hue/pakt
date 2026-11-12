"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { RANGES, type ChartRange } from "@/lib/mock/candles";
import { following } from "@/lib/mock/following";
import { me } from "@/lib/mock/me";
import { trades } from "@/lib/mock/trades";
import type { Token } from "@/lib/mock/types";
import { Chart } from "./Chart";
import { Checkbox } from "./Checkbox";

/** chart + range chips + overlay filters for the trade bubbles */
export function ChartPanel({ token }: { token: Token }) {
  const [range, setRange] = useState<ChartRange>("1D");
  const [mine, setMine] = useState(true);
  const [paktTrades, setPaktTrades] = useState(true);
  const [followingOnly, setFollowingOnly] = useState(false);
  const [minSize, setMinSize] = useState(false);

  const shown = trades(token).filter((t) => {
    const isMine = t.account === me.account;
    if (isMine) return mine;
    if (t.paktId && !paktTrades) return false;
    if (followingOnly && !following.includes(t.account)) return false;
    return !minSize || t.usd > 100;
  });

  return (
    <section className="shrink-0">
      <Chart token={token} range={range} trades={shown} />
      <div className="flex h-10 items-center border-b text-[15px]">
        <Tabs items={RANGES.map((r) => ({ id: r, label: r }))} value={range} onChange={setRange} className="h-[18px] [&>button]:border-l-0 [&>button]:px-2.5" />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
        <span className="border-r pr-4 text-[13px] font-medium">Chart overlays</span>
        <Checkbox label="My trades" checked={mine} onChange={setMine} />
        <Checkbox label="Pakt trades" checked={paktTrades} onChange={setPaktTrades} />
        <Checkbox label="Following only" checked={followingOnly} onChange={setFollowingOnly} />
        <Checkbox label="Min size (>$100)" checked={minSize} onChange={setMinSize} />
      </div>
    </section>
  );
}
