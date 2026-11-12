"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { ChevronsLeftIcon } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { accountFeed } from "@/lib/api";
import { ago, count, usd } from "@/lib/format";
import { loadHoldings, paktName, useLoad, useNow } from "@/lib/home/data";
import { useWallet } from "@/lib/near/wallet";

const KINDS = ["All", "Member", "Fee only"] as const;
type Kind = (typeof KINDS)[number];

/** home: » button that hides the panel */
type Props = { onCollapse?: () => void };

/** "Your positions": the connected account's shares in each pakt */
export function Positions({ onCollapse }: Props) {
  const { accountId } = useWallet();
  const [open, setOpen] = useState(true);
  const [kind, setKind] = useState<Kind>("All");
  const now = useNow();
  const all = useLoad(accountId ? () => loadHoldings(accountId) : null, [accountId]);

  // closed = pakts this account left and holds nothing in now
  const left = useLoad(accountId && !open ? () => accountFeed(accountId, { limit: 100 }) : null, [accountId, open]);
  const error = open ? all.error : all.error ?? left.error;
  const closed =
    all.data && left.data
      ? [...new Map(left.data.items.filter((e) => e.kind === "leave").map((e) => [e.vault, e.ts_ms])).entries()].filter(
          ([v]) => !all.data!.some((h) => h.pakt.vault === v),
        )
      : undefined;
  const data = open ? all.data?.filter((h) => kind === "All" || (kind === "Member") === h.member) : closed;

  let body;
  if (!accountId) {
    body = <p className="pt-6 text-center text-sm text-text-2">Connect wallet to check open positions</p>;
  } else if (error) {
    body = <p className="pt-6 text-center text-sm text-text-2">Could not load positions</p>;
  } else if (!data) {
    body = (
      <div className="mt-3 space-y-1">
        {[0, 1].map((i) => <Skeleton key={i} className="h-[52px] rounded-xl" />)}
      </div>
    );
  } else if (!data.length) {
    body = <p className="pt-6 text-center text-sm text-text-2">{open ? "No open positions" : "No closed positions"}</p>;
  } else if (!open) {
    body = (
      <ul className="mt-3 space-y-1">
        {closed!.map(([vault, ts]) => (
          <li key={vault}>
            <Link href={`/pakt/${paktName(vault)}`} className="flex h-[52px] items-center gap-3 rounded-xl px-2 hover:bg-panel-2/60">
              <Avatar name={paktName(vault)} size={32} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm leading-5">{paktName(vault)}</span>
                <span className="text-xs leading-5 text-text-2">Left {ago(Math.floor((now - ts) / 1000))} ago</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  } else {
    body = (
      <ul className="mt-3 space-y-1">
        {all.data!.filter((h) => kind === "All" || (kind === "Member") === h.member).map((h) => (
          <li key={h.pakt.vault}>
            <Link href={`/pakt/${h.pakt.name}`} className="flex h-[52px] items-center gap-3 rounded-xl px-2 hover:bg-panel-2/60">
              <Avatar name={h.pakt.name} size={32} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm leading-5">{h.pakt.name}</span>
                <span className="truncate text-xs leading-5 text-text-2">
                  {count(Number(h.shares))} shares{h.member ? "" : " · fee only"}
                </span>
              </span>
              <span className="text-sm leading-5">{h.value === null ? "—" : usd(h.value)}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Your positions</h2>
        {onCollapse && (
          <button type="button" aria-label="Hide positions" onClick={onCollapse} className="text-text-2 hover:text-text">
            <ChevronsLeftIcon className="size-4 rotate-180" />
          </button>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        {(["Open", "Closed"] as const).map((o) => {
          const on = (o === "Open") === open;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => setOpen(o === "Open")}
              className={`flex h-5 items-center gap-1 rounded-md px-1.5 text-xs font-bold transition-colors ${on ? "bg-accent-bg text-accent" : "text-text-2 hover:text-text"}`}
            >
              {on && <span className="size-1 rounded-full bg-current" />}
              {o}
            </button>
          );
        })}
      </div>
      <Segmented options={KINDS} value={kind} onChange={setKind} className="mt-3" />
      {body}
    </section>
  );
}
