import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarStack } from "@/components/ui/AvatarStack";
import type { LeaderTrader } from "@/lib/api";
import { compact, signed, wholeUsd } from "@/lib/format";
import { usdNum } from "@/lib/home/data";

type Props = {
  trader: LeaderTrader;
  rank: number;
  /** pakt names they trade for */
  paktNames: string[];
};

export function TraderRow({ trader, rank, paktNames }: Props) {
  const pnl = usdNum(trader.pnl);
  return (
    <li className="flex h-[57px] items-center gap-3 pl-2">
      <span className="w-5 text-xs text-text-2">{rank}.</span>
      <Avatar name={trader.trader} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link href={`/u/${trader.trader}`} className="truncate text-sm leading-5 hover:underline">{trader.trader}</Link>
        <span className="text-xs leading-5 text-text-2">
          {trader.trades} trades · {compact(usdNum(trader.volume))} vol
        </span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <span className={`text-sm leading-5 ${pnl < 0 ? "text-down" : "text-up"}`}>{signed(pnl, wholeUsd)}</span>
        <AvatarStack names={paktNames} />
      </span>
    </li>
  );
}
