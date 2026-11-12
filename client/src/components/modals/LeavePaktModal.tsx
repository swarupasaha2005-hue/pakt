"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { usd } from "@/lib/format";
import type { Holding } from "@/lib/mock/holdings";

type Props = {
  name: string;
  /** 0–1 */
  share: number;
  value: number;
  /** your slice of trader + platform fees, 0 below the high-water mark */
  fees: number;
  holdings: Holding[];
  onClose: () => void;
  onLeave: () => void;
};

export function LeavePaktModal({ name, share, value, fees, holdings, onClose, onLeave }: Props) {
  const netValue = Math.max(0, value - fees);
  const feeRetention = value > 0 ? netValue / value : 0;
  const payouts = holdings.map((holding) => ({
    symbol: holding.symbol,
    amount: holding.amount * share * feeRetention,
  }));
  const rows = [
    ["Your share", `${(share * 100).toFixed(1)}%`],
    ["Value", usd(value)],
    ["Fees settled first", fees > 0 ? `-${usd(fees)}` : "No fee"],
  ];

  return (
    <Modal open onClose={onClose} label={`Leave ${name}?`}>
      <h2 className="text-xl font-bold">Leave {name}?</h2>
      <dl className="my-4 space-y-2 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <dt className="text-text-2">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <section className="mb-4 rounded-xl bg-panel-2 p-3">
        <h3 className="text-xs font-bold text-text-2">You receive in kind</h3>
        {payouts.length ? (
          <ul className="mt-2 space-y-1.5 text-xs">
            {payouts.map(({ symbol, amount }) => (
              <li key={symbol} className="flex justify-between">
                <span>{symbol}</span>
                <span>{amount.toLocaleString("en-US", { maximumSignificantDigits: 6 })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-text-2">No open token positions.</p>
        )}
        <p className="mt-2 border-t border-border pt-2 text-xs text-text-2">≈ {usd(netValue)} total</p>
      </section>
      <Button variant="down-outline" size="lg" className="w-full" onClick={onLeave}>
        Leave pakt
      </Button>
    </Modal>
  );
}
