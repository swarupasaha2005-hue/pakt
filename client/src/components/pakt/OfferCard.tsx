import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { compact, usd } from "@/lib/format";
import type { Offer } from "@/lib/mock/offers";
import type { Pakt } from "@/lib/mock/types";

type Props = { offer: Offer; pakt: Pakt; onAccept: () => void; onDecline: () => void };

export function OfferCard({ offer, pakt, onAccept, onDecline }: Props) {
  return (
    <section id="trader-offer" aria-label="Trader offer" className="rounded-xl border border-accent bg-panel-2 p-4">
      <div className="flex items-center gap-3">
        <Avatar name={pakt.name} size={36} />
        <h3 className="text-base font-bold">{pakt.name} wants to hire you</h3>
      </div>
      <p className="mt-2 text-xs text-text-2">
        Budget {usd(offer.budget)} · max {usd(offer.maxPerTrade)}/trade
        <br />
        Stop-loss {offer.stopLoss}% · your fee {offer.fee}%
        <br />
        {pakt.members.length} members · {compact(pakt.vaultValue)} vault
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onDecline}>
          Decline
        </Button>
        <Button variant="primary" onClick={onAccept}>
          Accept
        </Button>
      </div>
    </section>
  );
}
