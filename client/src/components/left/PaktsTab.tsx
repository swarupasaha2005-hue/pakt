"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CreatePaktModal } from "@/components/modals/CreatePaktModal";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Pct } from "@/components/ui/Pct";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { leaderboard } from "@/lib/api";
import { compact } from "@/lib/format";
import { loadHoldings, loadPakts, useLoad, type PaktInfo } from "@/lib/home/data";
import { useWallet } from "@/lib/near/wallet";

const CHIPS = ["Mine", "All", "Open to join", "Hiring"] as const;
type Chip = (typeof CHIPS)[number];

export function PaktsTab() {
  const { accountId } = useWallet();
  const [picked, setPicked] = useState<Chip | null>(null);
  const [creating, setCreating] = useState(false);
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
        <li>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mb-1 flex h-11 w-full items-center gap-2 rounded-xl bg-pink/10 px-3 text-sm font-bold text-pink hover:bg-pink/15"
          >
            <span className="text-lg leading-none">+</span> Create your pakt
            <span className="ml-auto text-lg leading-none">›</span>
          </button>
        </li>
        {error ? (
          <li className="py-10 text-center text-sm text-text-2">Could not load pakts</li>
        ) : loading ? (
          [0, 1].map((i) => <li key={i}><Skeleton className="h-16 rounded-xl" /></li>)
        ) : (
          !list.length && <li className="py-10 text-center text-sm text-text-2">{chip === "Mine" ? "You are not in a pakt yet" : "No pakts here"}</li>
        )}
        {!loading && list.map((p) => {
          const change = board.data?.pakts.items.find((x) => x.vault === p.vault)?.change;
          return (
            <li key={p.vault}>
              <Link
                href={`/pakt/${p.name}`}
                className={`flex h-16 items-center gap-3 rounded-xl px-2 transition-colors ${pathname === `/pakt/${p.name}` ? "bg-panel-2" : "hover:bg-panel-2/60"}`}
              >
                <Avatar name={p.name} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm leading-5">{p.name}</span>
                  <span className="truncate text-xs leading-5 text-text-2">
                    {p.members} members · {p.value === null ? "—" : compact(p.value)} vault
                  </span>
                  <span className="flex items-center gap-1 truncate text-xs leading-4 text-text-2">
                    {p.trader ? <>trader <Avatar name={p.trader.account} size={14} /> {p.trader.account} · {p.trader.fee_bps / 100}%</> : <Badge tone="neutral">Hiring</Badge>}
                  </span>
                </span>
                {change !== undefined && (
                  <span className="flex flex-col items-end self-start pt-2.5">
                    <span className="text-xs leading-5 text-text-2">7D</span>
                    <Pct value={change * 100} className="text-xs leading-5" />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      {creating && <CreatePaktModal onClose={() => setCreating(false)} />}
    </>
  );
}
