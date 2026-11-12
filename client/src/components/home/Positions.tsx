"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ChevronsLeftIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { count, usd } from "@/lib/format";
import { loadHoldings, useLoad } from "@/lib/home/data";
import { useWallet } from "@/lib/near/wallet";

/** home: » button that hides the panel */
type Props = { onCollapse?: () => void };

/** "Your positions": the connected account's shares in each pakt */
export function Positions({ onCollapse }: Props) {
  const { accountId, ready, signIn } = useWallet();
  const { data, error } = useLoad(accountId ? () => loadHoldings(accountId) : null, [accountId]);

  let body;
  if (!accountId) {
    body = (
      <div className="flex flex-col items-center gap-3 pt-6 text-center text-sm text-text-2">
        Connect a wallet to see your positions
        <Button variant="primary" disabled={!ready} onClick={signIn}>Connect wallet</Button>
      </div>
    );
  } else if (error) {
    body = <p className="pt-6 text-center text-sm text-text-2">Could not load positions</p>;
  } else if (!data) {
    body = (
      <div className="mt-3 space-y-1">
        {[0, 1].map((i) => <Skeleton key={i} className="h-[52px] rounded-xl" />)}
      </div>
    );
  } else if (!data.length) {
    body = <p className="pt-6 text-center text-sm text-text-2">No positions yet</p>;
  } else {
    body = (
      <ul className="mt-3 space-y-1">
        {data.map((h) => (
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
        <h2 className="text-xl">Your positions</h2>
        {onCollapse && (
          <button type="button" aria-label="Hide positions" onClick={onCollapse} className="text-text-2 hover:text-text">
            <ChevronsLeftIcon className="size-5 rotate-180" />
          </button>
        )}
      </div>
      {body}
    </section>
  );
}
