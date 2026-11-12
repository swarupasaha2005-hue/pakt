"use client";

import { useState } from "react";
import { Row } from "@/components/left/Row";
import { Avatar } from "@/components/ui/Avatar";
import { SortIcon } from "@/components/ui/icons";
import { Pct } from "@/components/ui/Pct";
import { Segmented } from "@/components/ui/Segmented";
import { signedUsd } from "@/lib/format";
import type { Position } from "@/lib/mock/positions";
import { tokens } from "@/lib/mock/tokens";
import { ChipGroup } from "./ChipGroup";

const STATUS = ["Open", "Closed"] as const;
const KINDS = ["All", "Solo", "Pakts"] as const;

type Props = {
  account: string;
  /** solo positions (owner = account) and positions of related pakts, newest first */
  positions: Position[];
  title: string;
};

export function PositionsCard({ account, positions, title }: Props) {
  const [status, setStatus] = useState<(typeof STATUS)[number]>("Open");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("All");
  const [sort, setSort] = useState<"Recent" | "PnL">("Recent");

  const rows = positions
    .filter((p) => p.open === (status === "Open"))
    .filter((p) => kind === "All" || (kind === "Solo") === (p.owner === account))
    .toSorted((a, b) => (sort === "PnL" ? b.pnl - a.pnl : 0));

  return (
    <section className="overflow-hidden rounded-xl border">
      <div className="flex h-[43px] items-center justify-between bg-panel pr-2 pl-2.5">
        <h2 className="text-base">{title}</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSort(sort === "Recent" ? "PnL" : "Recent")}
            className="flex items-center gap-1 text-[15px] text-text-2 hover:text-text"
          >
            <SortIcon className="size-3.5" /> {sort}
          </button>
          <ChipGroup options={STATUS} value={status} onChange={setStatus} />
        </div>
      </div>
      <Segmented options={KINDS} value={kind} onChange={setKind} className="p-2.5" />
      <div className="flex justify-between border-b px-3 pb-1.5 text-[13px] text-text-2">
        <span>Token</span>
        <span>PnL</span>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-[15px] text-text-2">No {status.toLowerCase()} positions</p>
      ) : (
        <ul className="p-1">
          {rows.map((p) => {
            const t = tokens.find((t) => t.symbol === p.symbol);
            return (
              <li key={p.id}>
                <Row
                  href={`/token/${p.symbol}`}
                  avatar={<Avatar name={p.symbol} glyph={t?.glyph} color={t?.color} size={32} />}
                  title={p.symbol}
                  subtitle={`${p.amount.toLocaleString("en-US")} · ${p.owner === account ? "Solo" : p.owner}`}
                  value={<span className={p.pnl < 0 ? "text-down" : "text-up"}>{signedUsd(p.pnl)}</span>}
                  change={<Pct value={p.pnlPct} />}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
