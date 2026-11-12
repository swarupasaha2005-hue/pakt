import { Button } from "@/components/ui/Button";
import { feeSplit, PLATFORM_FEE } from "@/lib/fees";
import { signed, usd } from "@/lib/format";

type Props = { profit: number; fee: number; connected: boolean; onSettle: () => void; onConnect: () => void };

/** live split of profit above the high-water mark */
export function SettlementCard({ profit, fee, connected, onSettle, onConnect }: Props) {
  const split = feeSplit(profit, fee);
  const rows = [
    [`Trader (${fee}%)`, split.trader],
    [`Platform (${PLATFORM_FEE}%)`, split.platform],
    [`Members (${100 - fee - PLATFORM_FEE}%)`, split.members],
  ] as const;
  return (
    <section className="border-b p-4">
      <h2 className="flex justify-between text-xs font-bold tracking-wide text-text-2 uppercase">
        Next settlement <span className="text-text">2d 4h</span>
      </h2>
      <dl className="mt-3 space-y-2 text-xs">
        <div className="flex justify-between">
          <dt className="text-text-2">Profit above HWM</dt>
          <dd className={profit > 0 ? "text-up" : "text-text-2"}>{profit > 0 ? signed(profit) : "$0.00"}</dd>
        </div>
        {profit > 0 ? (
          rows.map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <dt className="text-text-2">{k}</dt>
              <dd>{usd(v)}</dd>
            </div>
          ))
        ) : (
          <p className="text-xs text-text-3">Below the high-water mark, no fees.</p>
        )}
      </dl>
      {connected ? (
        <Button className="mt-3 w-full" onClick={onSettle}>Settle now</Button>
      ) : (
        <Button variant="primary" className="mt-3 w-full" onClick={onConnect}>Connect to settle</Button>
      )}
    </section>
  );
}
