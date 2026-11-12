import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { usd } from "@/lib/format";
import type { Pakt } from "@/lib/mock/types";

type Props = { pakt: Pakt; member: boolean; onPropose: () => void; onRaise: () => void; onFire: () => void };

export function TraderCard({ pakt, member, onPropose, onRaise, onFire }: Props) {
  return (
    <section className="border-b p-4">
      <h2 className="text-xs font-bold tracking-wide text-text-2 uppercase">Trader</h2>
      {pakt.trader ? (
        <>
          <p className="mt-3 flex items-center gap-2 text-base">
            <Avatar name={pakt.trader} size={28} /> {pakt.trader} <Badge>{pakt.fee}%</Badge>
          </p>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <dt className="text-text-2">Budget</dt>
              <dd>
                {usd(pakt.budgetUsed)} / {usd(pakt.budget)}
              </dd>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-panel-2">
              <div className="h-full bg-accent" style={{ width: `${Math.min(100, (pakt.budgetUsed / pakt.budget) * 100)}%` }} />
            </div>
            <div className="flex justify-between">
              <dt className="text-text-2">Max / trade</dt>
              <dd>{usd(pakt.maxPerTrade)}</dd>
            </div>
          </dl>
          {member && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button onClick={onRaise}>Raise budget</Button>
              <Button variant="down-outline" onClick={onFire}>
                Fire
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="mt-3 text-xs text-text-2">No trader yet</p>
          {member && (
            <Button variant="primary" className="mt-3 w-full" onClick={onPropose}>
              Propose trader
            </Button>
          )}
        </>
      )}
    </section>
  );
}
