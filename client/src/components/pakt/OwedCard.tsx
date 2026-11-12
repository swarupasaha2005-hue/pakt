"use client";

import { Button } from "@/components/ui/Button";
import { claim, type Tx } from "@/lib/near/contracts";
import { registerFt, useTx } from "@/lib/pakt/tx";
import { amount } from "@/lib/pakt/units";
import { TxStatus } from "./TxStatus";

type Props = { vault: string; account: string; owed: [string, string][]; onDone: () => void };

/** payouts that failed (usually not registered on the token): register, then claim, in one prompt */
export function OwedCard({ vault, account, owed, onDone }: Props) {
  const tx = useTx(onDone);
  return (
    <section className="border-b p-4">
      <h2 className="text-xs font-bold tracking-wide text-text-2 uppercase">Unclaimed payouts</h2>
      {owed.map(([token, raw]) => (
        <div key={token} className="mt-2 flex items-center justify-between text-xs">
          {amount(token, raw)}
          <Button size="sm" disabled={tx.pending} onClick={() => tx.run([registerFt(token, account), ...claim(vault, token)] as Tx[])}>
            Claim
          </Button>
        </div>
      ))}
      <TxStatus {...tx} done="Claimed" />
    </section>
  );
}
