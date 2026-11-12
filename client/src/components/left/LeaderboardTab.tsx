"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { me } from "@/lib/mock/me";
import { pakts } from "@/lib/mock/pakts";
import { traders } from "@/lib/mock/traders";
import type { Range } from "@/lib/mock/types";
import { PaktGrid } from "./leaderboard/PaktGrid";
import { TraderRow } from "./leaderboard/TraderRow";
import { YourRank } from "./leaderboard/YourRank";

const KINDS = ["Traders", "Solo"] as const;
const SHOW = ["All", "Hiring"] as const;
const RANGES = ["24H", "7D", "30D", "ALL"] as const satisfies readonly Range[];

const paktNames = (account: string) => pakts.filter((p) => p.trader === account).map((p) => p.name);

export function LeaderboardTab() {
  const [kind, setKind] = useState<(typeof KINDS)[number]>("Traders");
  const [show, setShow] = useState<(typeof SHOW)[number]>("All");
  const [range, setRange] = useState<Range>("24H");

  const board = traders
    .filter((t) => (kind === "Traders" || paktNames(t.account).length === 0) && (show === "All" || t.openToHire))
    .toSorted((a, b) => b.pnl[range] - a.pnl[range]);
  const mine = board.findIndex((t) => t.account === me.account);

  return (
    <div className="flex-1 overflow-y-auto">
      <PaktGrid />
      <Segmented options={KINDS} value={kind} onChange={setKind} className="px-3 pt-2.5" />
      <div className="flex items-center justify-between px-3 pt-2">
        <Select label="Show" options={SHOW} value={show} onChange={setShow} />
        <Segmented options={RANGES} value={range} onChange={setRange} />
      </div>
      <YourRank rank={mine < 0 ? undefined : mine + 1} pnl={board[mine]?.pnl[range]} />
      <ol className="px-3 py-1">
        {board.map((t, i) => (
          <TraderRow key={t.account} trader={t} rank={i + 1} pnl={t.pnl[range]} paktNames={paktNames(t.account)} />
        ))}
      </ol>
    </div>
  );
}
