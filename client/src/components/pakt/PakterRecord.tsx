"use client";

import { signed, usd } from "@/lib/format";
import { useLoad } from "@/lib/home/data";
import { getTraderRecord } from "@/lib/near/contracts";

/** the pakter's track record across all pakts, kept by the factory on chain */
export function PakterRecord({ account }: { account: string }) {
  const r = useLoad(() => getTraderRecord(account), [account]).data;
  if (r === undefined) return null;
  if (!r) return <p className="mt-2 text-xs text-text-3">No on-chain record yet</p>;
  const pnl = Number(r.profit_usd_e6) / 1e6;
  return (
    <div className="mt-3 rounded-lg bg-panel-2 px-3 py-2 text-xs">
      <p className="text-text-2">On-chain record, all pakts</p>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums">
        <span>{r.hires} hired</span>
        <span className={r.fires ? "text-down" : ""}>{r.fires} fired</span>
        <span className={pnl > 0 ? "text-up" : pnl < 0 ? "text-down" : ""}>{signed(pnl)} P/L</span>
        <span className="text-text-2">{usd(Number(r.fees_earned_usd_e6) / 1e6)} fees</span>
      </p>
    </div>
  );
}
