"use client";

import { useState } from "react";
import Link from "next/link";
import { DepositModal } from "@/components/modals/DepositModal";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ChevronDownIcon, CopyIcon, StarIcon, UsersIcon } from "@/components/ui/icons";
import { Pct } from "@/components/ui/Pct";
import { Skeleton } from "@/components/ui/Skeleton";
import { leaderboard } from "@/lib/api";
import { usd } from "@/lib/format";
import { loadPakts, useLoad, useStarred, type PaktInfo } from "@/lib/home/data";

export const PAKT_FILTERS = ["All", "Open", "Hiring", "Starred"] as const;
export type PaktFilter = (typeof PAKT_FILTERS)[number];
type SortKey = "value" | "change" | "members" | "fee";
const COLS: { label: string; key?: SortKey }[] = [
  { label: "Trader" }, { label: "Vault value", key: "value" }, { label: "7D share price", key: "change" }, { label: "Members", key: "members" }, { label: "Fee", key: "fee" },
];

export function PaktsTable({ filter = "All" }: { filter?: PaktFilter }) {
  const { data, error } = useLoad(loadPakts, []);
  const board = useLoad(() => leaderboard({ range: "7d", limit: 100 }), []);
  const { starred, toggle } = useStarred();
  const change = (vault: string) => board.data?.pakts.items.find((p) => p.vault === vault)?.change;
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "value", desc: true });
  const [squish, setSquish] = useState<{ name: string; n: number }>({ name: "", n: 0 });
  const [deposit, setDeposit] = useState<string | null>(null);
  const sortVal = (p: PaktInfo) =>
    sort.key === "value" ? (p.value ?? 0) : sort.key === "change" ? (change(p.vault) ?? 0) : sort.key === "members" ? p.members : (p.trader?.fee_bps ?? 0);
  const keep = (p: PaktInfo) =>
    filter === "All" || (filter === "Open" ? p.joinMode === "Open" : filter === "Hiring" ? !p.trader : starred.includes(p.name));

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[760px] text-left">
        <thead className="sticky top-0 z-20 bg-panel text-xs text-text-2 [&_th]:font-medium">
          <tr className="h-8 border-b">
            <th className="px-3">Pakt name</th>
            {COLS.map((c) => (
              <th key={c.label} className="px-3" aria-sort={c.key && sort.key === c.key ? (sort.desc ? "descending" : "ascending") : undefined}>
                {c.key ? (
                  <button
                    type="button"
                    onClick={() => setSort((s) => ({ key: c.key!, desc: s.key === c.key ? !s.desc : true }))}
                    className={`flex items-center gap-1 hover:text-text ${sort.key === c.key ? "text-text" : ""}`}
                  >
                    {c.label}
                    <ChevronDownIcon className={`size-3 transition-transform ${sort.key === c.key ? (sort.desc ? "" : "rotate-180") : "opacity-40"}`} />
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data?.filter(keep).toSorted((a, b) => (sortVal(b) - sortVal(a)) * (sort.desc ? 1 : -1)).map((p) => {
            const star = starred.includes(p.name);
            const c = change(p.vault);
            return (
              <tr key={p.vault} className="group relative h-14 text-base font-medium hover:bg-white/[0.03] [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg">
                <td className="px-3">
                  <span className="flex w-full items-center gap-3">
                    <button type="button" aria-label={star ? `Unstar ${p.name}` : `Star ${p.name}`} aria-pressed={star} onClick={() => {
                        toggle(p.name);
                        setSquish((s) => ({ name: p.name, n: s.n + 1 }));
                      }}
                      className="relative z-10"
                    >
                      <StarIcon
                        key={squish.name === p.name ? squish.n : 0}
                        className={`size-4 ${squish.name === p.name ? "animate-squish" : ""} ${star ? "fill-current text-accent" : "text-text-2 hover:text-text"}`} />
                    </button>
                    <Avatar name={p.name} />
                    <span className="flex min-w-0 flex-col leading-5">
                      <Link href={`/pakt/${p.name}`} className="after:absolute after:inset-0">{p.name}</Link>
                      <span className="flex items-center gap-1.5 text-xs text-text-2">
                        {p.trader?.paused ? "Paused" : p.joinMode === "Open" ? "Open" : "Invite only"}
                        <button type="button" aria-label={`Copy ${p.name} vault id`} onClick={() => navigator.clipboard.writeText(p.vault)} className="relative z-10 text-text-3 hover:text-text">
                          <CopyIcon className="size-3" />
                        </button>
                      </span>
                    </span>
                    {p.joinMode === "Open" && (
                      <button
                        type="button"
                        onClick={() => setDeposit(p.name)}
                        className="relative z-10 ml-auto h-6 w-14 shrink-0 rounded-md bg-chip text-xs font-bold opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        Deposit
                      </button>
                    )}
                  </span>
                </td>
                <td className="px-3">
                  {p.trader ? (
                    <span className="flex max-w-48 items-center gap-2">
                      <Avatar name={p.trader.account} size={24} />
                      <span className="truncate" title={p.trader.account}>{p.trader.account}</span>
                    </span>
                  ) : (
                    <span className="text-text-3">Hiring</span>
                  )}
                </td>
                <td className="px-3">{p.value === null ? <span className="text-text-3">—</span> : usd(p.value)}</td>
                <td className="px-3">{c === undefined ? <span className="text-text-3">—</span> : <Pct value={c * 100} className="text-sm" />}</td>
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
      {!!data?.length && !data.some(keep) && <p className="py-10 text-center text-sm text-text-2">No matching pakts</p>}
      {deposit && <DepositModal to={deposit} onClose={() => setDeposit(null)} />}
    </div>
  );
}
