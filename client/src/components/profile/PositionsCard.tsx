"use client";

import { useState } from "react";
import { Row } from "@/components/left/Row";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { SortIcon } from "@/components/ui/icons";
import { usd } from "@/lib/format";
import type { Position } from "@/lib/profile/load";

type Props = {
  /** pakts where the account holds shares, newest first */
  positions: Position[];
  title: string;
};

// shortcut: no per-holding pnl, a usd cost basis needs leave values the feed lacks
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
        <span>Value</span>
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
                change={<span className="text-text-2">{p.pct.toFixed(2)}% of pakt</span>}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
