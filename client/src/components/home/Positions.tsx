"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { ChevronsLeftIcon } from "@/components/ui/icons";
import { Pct } from "@/components/ui/Pct";
import { Segmented } from "@/components/ui/Segmented";
import { usd } from "@/lib/format";
import { pakts } from "@/lib/mock/pakts";
import { positions } from "@/lib/mock/positions";
import { tokens } from "@/lib/mock/tokens";

const FILTERS = ["All", "Solo", "Pakts"] as const;
type Filter = (typeof FILTERS)[number];

type Props = {
  /** token page: only this token */
  symbol?: string;
  /** home: » button that hides the panel */
  onCollapse?: () => void;
};

/** "Your positions": Open/Closed + All/Solo/Pakts */
export function Positions({ symbol, onCollapse }: Props) {
  const [open, setOpen] = useState(true);
  const [filter, setFilter] = useState<Filter>("All");

  const list = positions.filter(
    (p) => p.open === open && (!symbol || p.symbol === symbol) && (filter === "All" || (filter === "Solo") === !p.paktId),
  );

  const toggle = (
    <div className="flex h-[26px] rounded-lg border p-px text-[13px] font-semibold">
      {[true, false].map((o) => (
        <button
          key={String(o)}
          type="button"
          aria-pressed={open === o}
          onClick={() => setOpen(o)}
          className={`flex items-center gap-1.5 rounded-md px-2 ${open === o ? "bg-panel-2 text-accent" : "text-text-2 hover:text-text"}`}
        >
          {o ? "Open" : "Closed"}
          {o && open && <span className="size-1.5 rounded-full bg-accent" />}
        </button>
      ))}
    </div>
  );

  return (
    <section className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl">Your positions</h2>
        {onCollapse ? (
          <button type="button" aria-label="Hide positions" onClick={onCollapse} className="text-text-2 hover:text-text">
            <ChevronsLeftIcon className="size-5 rotate-180" />
          </button>
        ) : (
          toggle
        )}
      </div>
      {onCollapse && <div className="mt-4 flex justify-end">{toggle}</div>}
      <Segmented options={FILTERS} value={filter} onChange={setFilter} className="mt-3" />
      {list.length ? (
        <ul className="mt-3 space-y-1">
          {list.map((p) => {
            const t = tokens.find((x) => x.symbol === p.symbol)!;
            const pnlPct = (t.price / p.avgEntry - 1) * 100;
            return (
              <li key={`${p.symbol}-${p.paktId}`} className="flex h-[52px] items-center gap-3 rounded-xl px-2 hover:bg-panel-2/60">
                <Avatar name={t.symbol} src={t.logo} size={32} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] leading-5">{t.symbol}</span>
                  <span className="truncate text-[13px] leading-5 text-text-2">{pakts.find((x) => x.id === p.paktId)?.name ?? "Solo"}</span>
                </span>
                <span className="flex flex-col items-end">
                  <span className="text-[15px] leading-5">{usd(p.amount * t.price)}</span>
                  <Pct value={pnlPct} className="text-[13px] leading-5" />
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="pt-6 text-center text-[15px] text-text-2">No {open ? "open" : "closed"} positions</p>
      )}
    </section>
  );
}
