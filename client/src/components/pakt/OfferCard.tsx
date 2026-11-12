"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { compact, usd } from "@/lib/format";
import { acceptOffer, declineOffer, type Offer } from "@/lib/near/contracts";
import { useTx } from "@/lib/pakt/tx";
import { e6, left } from "@/lib/pakt/units";
import { TxStatus } from "./TxStatus";

type Props = { offer: Offer; name: string; vault: string; members: number; value: bigint | null; now: number; onDone: () => void };

/** shown only to the offered trader */
export function OfferCard({ offer, name, vault, members, value, now, onDone }: Props) {
  const tx = useTx(onDone);
  const t = offer.terms;
  const expired = now >= offer.expires_ms;
  return (
    <section aria-label="Trader offer" className="rounded-xl border border-accent bg-panel-2 p-4">
      <div className="flex items-center gap-3">
        <Avatar name={name} size={36} />
        <h3 className="text-base font-medium">{name} wants to hire you</h3>
      </div>
      <p className="mt-2 text-xs text-text-2">
        Budget {usd(e6(t.budget))} · max {usd(e6(t.max_per_trade))}/trade
        <br />
        Stop-loss {t.stop_loss_bps / 100}% · your fee {t.fee_bps / 100}%
        <br />
        {members} members · {value === null ? "—" : compact(e6(value))} vault · {expired ? "expired" : `expires in ${left(offer.expires_ms - now)}`}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={tx.pending} onClick={() => tx.run(declineOffer(vault))}>
          Decline
        </Button>
        <Button variant="primary" disabled={tx.pending || expired} title={expired ? "Offer expired" : undefined} onClick={() => tx.run(acceptOffer(vault))}>
          Accept
        </Button>
      </div>
      <TxStatus {...tx} />
    </section>
  );
}
