import { Avatar } from "@/components/ui/Avatar";
import { signed, wholeUsd } from "@/lib/format";
import { me } from "@/lib/mock/me";

/** rank/pnl undefined = not on the board */
export function YourRank({ rank, pnl }: { rank?: number; pnl?: number }) {
  return (
    <div className="mx-3 flex items-center gap-2.5 border-b border-dashed py-3">
      <Avatar name={me.account} />
      <span className="flex flex-1 flex-col">
        <span className="text-sm leading-5 text-text-2">Your rank</span>
        <span className="text-base leading-5 font-semibold"><span className="text-accent">#</span> {rank ?? "-"}</span>
      </span>
      <span className="flex flex-col items-end">
        <span className="text-sm leading-5 text-text-2">PnL</span>
        <span className="text-base leading-5 text-text-2">{pnl === undefined ? "--" : signed(pnl, wholeUsd)}</span>
      </span>
    </div>
  );
}
