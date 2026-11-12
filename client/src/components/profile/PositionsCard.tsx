"use client";

import { useState } from "react";
import { Row } from "@/components/left/Row";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { SortIcon } from "@/components/ui/icons";
import { signed, usd } from "@/lib/format";
import type { Position } from "@/lib/profile/load";

/** profit vs usd paid in; trader fee shares cost nothing, so they count as profit */
export function Pnl({ value, cost }: { value: number | null; cost: number | null }) {
  if (value === null || cost === null) return <span className="text-text-2">—</span>;
  const raw = value - cost;
  const pnl = Math.abs(raw) < 0.005 ? 0 : raw; // sub-cent drift reads as flat
  const tone = pnl === 0 ? "text-text-2" : pnl > 0 ? "text-up" : "text-down";
  return (
    <span className={`whitespace-nowrap ${tone}`}>
      {pnl === 0 ? "$0.00" : signed(pnl)}
      {cost > 0 && pnl !== 0 && ` (${((pnl / cost) * 100).toFixed(2)}%)`}
    </span>
  );
}

type Props = {
  /** pakts where the account holds shares, newest first */
  positions: Position[];
  title: string;
};

export function PositionsCard({ positions, title }: Props) {
  const [sort, setSort] = useState<"Recent" | "Value">("Recent");
  const rows = sort === "Value" ? positions.toSorted((a, b) => (b.value ?? 0) - (a.value ?? 0)) : positions;

  return (
    <section className="overflow-hidden rounded-xl border">
      <div className="flex h-[43px] items-center justify-between bg-panel pr-2 pl-2.5">
        <h2 className="text-base">{title}</h2>
        <button
          type="button"
          onClick={() => setSort(sort === "Recent" ? "Value" : "Recent")}
          className="flex items-center gap-1 text-sm text-text-2 hover:text-text"
        >
          <SortIcon className="size-3.5" /> {sort}
        </button>
      </div>
      <div className="flex justify-between border-b px-3 pt-2.5 pb-1.5 text-xs text-text-2">
        <span>Pakt</span>
        <span>Value · P/L</span>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-2">No holdings</p>
      ) : (
        <ul className="p-1">
          {rows.map((p) => (
            <li key={p.vault}>
              <Row
                href={`/pakt/${p.name}`}
                avatar={<Avatar name={p.name} size={32} />}
                title={<>{p.name}{p.member ? <Badge tone="neutral">Member</Badge> : <Badge tone="neutral">Fee shares</Badge>}</>}
                subtitle={`Joined ${new Date(p.joinedMs).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                value={p.value === null ? "--" : usd(p.value)}
                change={<Pnl value={p.value} cost={p.cost} />}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
