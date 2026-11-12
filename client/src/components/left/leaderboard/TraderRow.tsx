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
  /** opens the hire flow; hidden for your own row */
  onHire?: () => void;
};

export function TraderRow({ trader, rank, paktNames, onHire }: Props) {
  const pnl = usdNum(trader.pnl);
  return (
    <li className="group relative flex h-14 items-center gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-panel-2/60">
      <span className="w-5 text-xs font-medium text-text-2">{rank}.</span>
      <Avatar name={trader.trader} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link href={`/u/${trader.trader}`} className="truncate text-sm leading-5 font-medium after:absolute after:inset-0">{trader.trader}</Link>
        <span className="text-xs leading-5 text-text-2">
          {trader.trades} trades · {compact(usdNum(trader.volume))} vol
        </span>
      </span>
      {onHire && (
        <button
          type="button"
          onClick={onHire}
          className="relative z-10 h-7 shrink-0 rounded-lg bg-accent px-2.5 text-xs font-medium text-white hover:brightness-110"
        >
          Hire
        </button>
      )}
      <span className="flex flex-col items-end gap-1">
        <span className={`text-sm leading-5 font-medium ${pnl < 0 ? "text-down" : "text-up"}`}>{signed(pnl, wholeUsd)}</span>
        <AvatarStack names={paktNames} />
      </span>
    </li>
  );
}
