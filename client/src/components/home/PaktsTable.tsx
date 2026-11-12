"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { StarIcon, UsersIcon } from "@/components/ui/icons";
import { Pct } from "@/components/ui/Pct";
import { Skeleton } from "@/components/ui/Skeleton";
import { leaderboard } from "@/lib/api";
import { usd } from "@/lib/format";
import { loadPakts, useLoad, useStarred } from "@/lib/home/data";

const COLS = ["Trader", "Vault value", "7D share price", "Members", "Fee"];

export function PaktsTable() {
  const { data, error } = useLoad(loadPakts, []);
  const board = useLoad(() => leaderboard({ range: "7d", limit: 100 }), []);
  const { starred, toggle } = useStarred();
  const change = (vault: string) => board.data?.pakts.items.find((p) => p.vault === vault)?.change;

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[760px] text-left">
        <thead className="sticky top-0 z-20 bg-panel text-xs text-text-2">
          <tr className="h-[38px] border-b">
            <th className="px-3">Pakt name</th>
            {COLS.map((c) => (
              <th key={c} className="px-3">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data?.toSorted((a, b) => (b.value ?? 0) - (a.value ?? 0)).map((p) => {
            const star = starred.includes(p.name);
            const c = change(p.vault);
            return (
              <tr key={p.vault} className="relative h-14 text-base hover:bg-panel-2/60">
                <td className="px-3">
                  <span className="flex items-center gap-3">
                    <button type="button" aria-label={star ? `Unstar ${p.name}` : `Star ${p.name}`} aria-pressed={star} onClick={() => toggle(p.name)} className="relative z-10">
                      <StarIcon className={`size-[18px] ${star ? "fill-current text-accent" : "text-text-2 hover:text-text"}`} />
                    </button>
                    <Avatar name={p.name} />
                    <span className="flex flex-col leading-5">
                      <Link href={`/pakt/${p.name}`} className="after:absolute after:inset-0">{p.name}</Link>
                      <span className="text-xs text-text-2">{p.trader?.paused ? "Paused" : p.joinMode === "Open" ? "Open" : "Invite only"}</span>
                    </span>
                  </span>
                </td>
                <td className="px-3">
                  {p.trader ? (
                    <span className="flex items-center gap-2">
                      <Avatar name={p.trader.account} size={24} />
                      {p.trader.account}
                    </span>
                  ) : (
                    <span className="text-text-3">Hiring</span>
                  )}
                </td>
                <td className="px-3">{p.value === null ? <span className="text-text-3">—</span> : usd(p.value)}</td>
                <td className="px-3">{c === undefined ? <span className="text-text-3">—</span> : <Pct value={c * 100} />}</td>
                <td className="px-3">
                  <span className="flex items-center gap-2">
                    <UsersIcon className="size-4 text-text-2" />
                    {p.members}
                  </span>
                </td>
                <td className="px-3">{p.trader ? <Badge>{p.trader.fee_bps / 100}% fee</Badge> : <span className="text-text-3">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!data && !error && (
        <div className="space-y-2 p-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
        </div>
      )}
      {error && <p className="py-10 text-center text-sm text-text-2">Could not load pakts</p>}
      {data?.length === 0 && <p className="py-10 text-center text-sm text-text-2">No pakts yet</p>}
    </div>
  );
}
