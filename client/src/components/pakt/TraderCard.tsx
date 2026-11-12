import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { usd } from "@/lib/format";
import type { VaultState } from "@/lib/near/contracts";
import { e6 } from "@/lib/pakt/units";

type Props = { state: VaultState; member: boolean; onPropose: () => void; onRaise: () => void; onFire: () => void };

export function TraderCard({ state, member, onPropose, onRaise, onFire }: Props) {
  const t = state.trader;
  return (
    <section className="border-b p-4">
      <h2 className="text-xs font-bold tracking-wide text-text-2 uppercase">Pakter</h2>
      {t ? (
        <>
          <p className="mt-3 flex items-center gap-2 text-base">
            <Avatar name={t.account} size={28} /> <span className="truncate">{t.account}</span> <Badge>{t.fee_bps / 100}%</Badge>
            {t.paused && <Badge tone="down">paused</Badge>}
          </p>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <dt className="text-text-2">Budget</dt>
              <dd>
                {usd(e6(t.budget_used))} / {usd(e6(t.budget))}
              </dd>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-panel-2">
              <div className="h-full bg-accent" style={{ width: `${Math.min(100, (Number(t.budget_used) / Number(t.budget)) * 100)}%` }} />
            </div>
            <div className="flex justify-between">
              <dt className="text-text-2">Max / trade</dt>
              <dd>{usd(e6(t.max_per_trade))}</dd>
            </div>
          </dl>
          {state.fire_pending ? (
            <p className="mt-3 text-xs text-down">Fire pending: waiting for the vault to settle fees.</p>
          ) : (
            member && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button onClick={onRaise}>Set budget</Button>
                <Button variant="down-outline" onClick={onFire}>
                  Fire
                </Button>
              </div>
            )
          )}
        </>
      ) : state.offer ? (
        <p className="mt-3 text-xs text-text-2">
          Offer out to {state.offer.terms.account}, waiting for them to accept.
        </p>
      ) : (
        <>
          <p className="mt-3 text-xs text-text-2">No pakter yet</p>
          {member ? (
            <Button variant="primary" className="mt-3 w-full" onClick={onPropose}>
              Propose pakter
            </Button>
          ) : (
            <p className="mt-1 text-xs text-text-3">Members propose and vote on a trader.</p>
          )}
        </>
      )}
    </section>
  );
}
