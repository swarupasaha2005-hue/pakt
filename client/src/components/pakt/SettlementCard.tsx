"use client";

import { Button } from "@/components/ui/Button";
import { feeSplit, PLATFORM_FEE } from "@/lib/fees";
import { signed, usd } from "@/lib/format";
import { settle } from "@/lib/near/contracts";
import { useTx } from "@/lib/pakt/tx";
import { left } from "@/lib/pakt/units";
import { TxStatus } from "./TxStatus";

type Props = {
  vault: string;
  /** usd above the high-water mark at oracle prices */
  profit: number;
  /** trader fee percent, 0 without a trader */
  fee: number;
  dueMs: number;
  now: number;
  /** null = may settle now, else why not */
  blocked: string | null;
  onDone: () => void;
};

/** live split of profit above the high-water mark; anyone may settle once the period is over */
export function SettlementCard({ vault, profit, fee, dueMs, now, blocked, onDone }: Props) {
  const tx = useTx(onDone);
  const split = feeSplit(profit, fee);
  const rows = [
    [`Trader (${fee}%)`, split.trader],
    [`Platform (${PLATFORM_FEE}%)`, split.platform],
    [`Members (${100 - fee - PLATFORM_FEE}%)`, split.members],
  ] as const;
  return (
    <section className="border-b p-4">
      <h2 className="flex justify-between text-xs font-bold tracking-wide text-text-2 uppercase">
        Next settlement <span className="text-text">{now >= dueMs ? "due now" : left(dueMs - now)}</span>
      </h2>
      <dl className="mt-3 space-y-2 text-xs">
        <div className="flex justify-between">
          <dt className="text-text-2">Profit above HWM</dt>
          <dd className={profit > 0 ? "text-up" : "text-text-2"}>{profit > 0 ? signed(profit) : "$0.00"}</dd>
        </div>
        {profit > 0 && fee > 0 ? (
          rows.map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <dt className="text-text-2">{k}</dt>
              <dd>{usd(v)}</dd>
            </div>
          ))
        ) : (
          <p className="text-xs text-text-3">{profit > 0 ? "No trader, no fees: the mark just rises." : "Below the high-water mark, no fees."}</p>
        )}
      </dl>
      <Button className="mt-3 w-full" disabled={!!blocked || tx.pending} onClick={() => tx.run(settle(vault))}>
        {blocked ?? "Settle now"}
      </Button>
      <TxStatus {...tx} done="Settled" />
    </section>
  );
}
