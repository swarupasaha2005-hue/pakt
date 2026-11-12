"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Pct } from "@/components/ui/Pct";
import { Segmented } from "@/components/ui/Segmented";
import { RowsSkeleton } from "@/components/ui/Skeleton";
import { leaderboard } from "@/lib/api";
import { compact } from "@/lib/format";
import { loadHoldings, loadPakts, useLoad, type PaktInfo } from "@/lib/home/data";
import { useWallet } from "@/lib/near/wallet";
import { Row } from "./Row";

const CHIPS = ["Mine", "All", "Open to join", "Hiring"] as const;
type Chip = (typeof CHIPS)[number];

export function PaktsTab() {
  const { accountId } = useWallet();
  const [picked, setPicked] = useState<Chip | null>(null);
  const pathname = usePathname();
  const { data, error } = useLoad(loadPakts, []);
  const mine = useLoad(accountId ? () => loadHoldings(accountId) : null, [accountId]);
  const board = useLoad(() => leaderboard({ range: "7d", limit: 100 }), []);

  // logged in: start on your pakts; logged out: all pakts
  const chips: readonly Chip[] = accountId ? CHIPS : CHIPS.filter((c) => c !== "Mine");
  const chip = picked && chips.includes(picked) ? picked : chips[0];
  const myVaults = mine.data?.map((h) => h.pakt.vault) ?? [];
  const view: Record<Chip, (p: PaktInfo) => boolean> = {
    All: () => true,
    "Open to join": (p) => p.joinMode === "Open" && !myVaults.includes(p.vault),
    Mine: (p) => myVaults.includes(p.vault),
    Hiring: (p) => !p.trader,
  };
  const loading = !data || (chip === "Mine" && !mine.data && !mine.error);
  const list = data?.filter(view[chip]) ?? [];

  return (
    <>
      <Segmented options={chips} value={chip} onChange={setPicked} className="px-3 pt-1.5 pb-2" />
      <ul className="flex-1 space-y-1 overflow-y-auto px-2">
        {error ? (
          <li className="py-10 text-center text-sm text-text-2">Could not load pakts</li>
        ) : loading ? (
          <li><RowsSkeleton n={5} className="px-0 py-0" /></li>
        ) : (
          !list.length && <li className="py-10 text-center text-sm text-text-2">{chip === "Mine" ? "You are not in a pakt yet. Join an open one or create your own." : "No pakts here"}</li>
        )}
        {!loading && list.map((p) => {
          const change = board.data?.pakts.items.find((x) => x.vault === p.vault)?.change;
          return (
            <li key={p.vault}>
              <Row
                href={`/pakt/${p.name}`}
                selected={pathname === `/pakt/${p.name}`}
                avatar={<Avatar name={p.name} />}
                title={<>{p.name}{!p.trader && <Badge tone="neutral">Hiring</Badge>}</>}
                subtitle={p.trader ? `${p.trader.account} · ${p.trader.fee_bps / 100}% fee` : `${p.members} members`}
                value={p.value === null ? "—" : compact(p.value)}
                change={change === undefined ? <span className="text-text-3">7D</span> : <Pct value={change * 100} />}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}
