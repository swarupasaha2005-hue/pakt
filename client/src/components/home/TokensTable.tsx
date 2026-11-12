"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { tokens } from "@/lib/mock/tokens";
import { changeIn, TIMEFRAMES, volumeIn, type Timeframe } from "@/lib/mock/timeframes";
import type { Token } from "@/lib/mock/types";
import { FilterSelect } from "./FilterSelect";
import { SortHeader } from "./SortHeader";
import { TokenRow } from "./TokenRow";

const CHIPS = ["Trending", "Allowed", "Most held", "Watchlist"] as const;
type Chip = (typeof CHIPS)[number];

const SORTS = {
  mcap: (t: Token) => t.mcap,
  change: (t: Token, tf: Timeframe) => changeIn(t, tf),
  volume: (t: Token, tf: Timeframe) => volumeIn(t, tf),
  holders: (t: Token) => t.holders,
};
type SortKey = keyof typeof SORTS;

const ROWS = [10, 25, 100].map((n) => ({ value: n, label: String(n) }));
const MCAP = [
  { value: 0, label: "Market cap" },
  { value: 1e7, label: "MC > $10M" },
  { value: 1e9, label: "MC > $1B" },
  { value: 1e11, label: "MC > $100B" },
];
const VOLUME = [
  { value: 0, label: "Volume" },
  { value: 1e6, label: "Vol > $1M" },
  { value: 1e8, label: "Vol > $100M" },
];

function byChip(chip: Chip, starred: string[]) {
  if (chip === "Trending") return tokens.toSorted((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h));
  if (chip === "Allowed") return tokens.filter((t) => t.allowed);
  if (chip === "Most held") return tokens.toSorted((a, b) => b.holders - a.holders);
  return tokens.filter((t) => starred.includes(t.symbol));
}

type Props = { starred: string[]; onStar: (symbol: string) => void };

export function TokensTable({ starred, onStar }: Props) {
  const [chip, setChip] = useState<Chip>("Trending");
  const [rows, setRows] = useState(100);
  const [tf, setTf] = useState<Timeframe>("24h");
  const [minMcap, setMinMcap] = useState(0);
  const [minVolume, setMinVolume] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean } | null>(null);
  const [quickBuy, setQuickBuy] = useState("100");

  const list = byChip(chip, starred)
    .filter((t) => t.mcap >= minMcap && volumeIn(t, tf) >= minVolume)
    .toSorted((a, b) => (sort ? (SORTS[sort.key](b, tf) - SORTS[sort.key](a, tf)) * (sort.desc ? 1 : -1) : 0))
    .slice(0, rows);

  const header = (key: SortKey, label: string) => (
    <SortHeader
      label={label}
      active={sort?.key === key}
      desc={sort?.key !== key || sort.desc}
      onClick={() => setSort({ key, desc: sort?.key === key ? !sort.desc : true })}
    />
  );

  return (
    <>
      <div className="shrink-0 space-y-2.5 border-b px-3 py-2.5">
        <Segmented options={CHIPS} value={chip} onChange={setChip} />
        <div className="flex flex-wrap gap-2">
          <FilterSelect label="Rows" value={rows} options={ROWS} onChange={setRows} />
          <Segmented options={TIMEFRAMES} value={tf} onChange={setTf} className="gap-0.5 rounded-lg border p-px [&>button]:h-[22px] [&>button]:border-0" />
          <FilterSelect label="Min market cap" value={minMcap} options={MCAP} onChange={setMinMcap} />
          <FilterSelect label="Min volume" value={minVolume} options={VOLUME} onChange={setMinVolume} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[920px] text-left">
          <thead className="sticky top-0 z-20 bg-panel text-[13px] text-text-2">
            <tr className="h-[38px] border-b">
              <th className="w-[300px] border-r px-3 font-normal">
                <span className="flex items-center justify-between">
                  Token name
                  <label className="flex items-center gap-1.5">
                    Quick buy
                    <span className="flex h-[26px] w-[74px] items-center rounded-lg border px-2 text-base text-text">
                      $
                      <input
                        inputMode="decimal"
                        aria-label="Quick buy amount"
                        value={quickBuy}
                        onChange={(e) => setQuickBuy(e.target.value.replace(/[^\d.]/g, ""))}
                        className="w-full bg-transparent text-right outline-none"
                      />
                    </span>
                  </label>
                </span>
              </th>
              {header("mcap", "Market cap")}
              {header("change", `${tf} change`)}
              {header("volume", `${tf} volume`)}
              {header("holders", "Holders")}
              <th className="px-3 font-normal">Top pakt</th>
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <TokenRow key={t.symbol} token={t} tf={tf} starred={starred.includes(t.symbol)} onStar={onStar} quickBuy={Number(quickBuy)} />
            ))}
          </tbody>
        </table>
        {!list.length && <p className="py-10 text-center text-[15px] text-text-2">{chip === "Watchlist" ? "Star tokens to watch them here" : "No tokens match"}</p>}
      </div>
    </>
  );
}
