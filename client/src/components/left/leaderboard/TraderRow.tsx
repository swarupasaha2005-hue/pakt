"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { signed, wholeUsd } from "@/lib/format";
import { me } from "@/lib/mock/me";
import type { Trader } from "@/lib/mock/types";

type Props = {
  trader: Trader;
  rank: number;
  pnl: number;
  /** pakt names they trade for */
  paktNames: string[];
};

const chip = "inline-flex h-5 w-fit items-center rounded-md px-2 text-xs font-bold transition hover:brightness-125";

export function TraderRow({ trader, rank, pnl, paktNames }: Props) {
  const [following, setFollowing] = useState(false);

  return (
    <li className="flex h-[57px] items-center gap-3 pl-2">
      <span className="w-5 text-xs text-text-2">{rank}.</span>
      <Avatar name={trader.account} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link href={`/profile/${trader.account}`} className="truncate text-sm leading-5 hover:underline">{trader.account}</Link>
        {trader.openToHire ? (
          // fee is fixed to the trader's asking fee, no negotiation
          <Link href={`/pakt/${me.paktIds[0]}?propose=${trader.account}`} className={`${chip} bg-accent-bg text-accent`}>
            Hire · {trader.askingFee}%
          </Link>
        ) : (
          <button
            type="button"
            aria-pressed={following}
            onClick={() => setFollowing(!following)}
            className={`${chip} bg-panel-2 ${following ? "text-text" : "text-text-2"}`}
          >
            {following ? "Following" : "Follow"}
          </button>
        )}
      </span>
      <span className="flex flex-col items-end gap-1">
        <span className={`text-sm leading-5 ${pnl < 0 ? "text-down" : "text-up"}`}>{signed(pnl, wholeUsd)}</span>
        <AvatarStack names={paktNames} />
      </span>
    </li>
  );
}
