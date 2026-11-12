"use client";

import { Button } from "@/components/ui/Button";
import type { Fix } from "@/lib/pakt/recover";
import { useTx } from "@/lib/pakt/tx";
import { TxStatus } from "./TxStatus";

/** one-click fixes for a stuck vault; any account can run them */
export function RecoveryCard({ fixes, onDone }: { fixes: Fix[]; onDone: () => void }) {
  const tx = useTx(onDone);
  return (
    <section className="border-b p-4">
      <h2 className="text-xs font-bold tracking-wide text-text-2 uppercase">Needs attention</h2>
      {fixes.map((f, i) => (
        <div key={i} className="mt-2 flex items-center justify-between gap-3 text-xs">
          <span className="text-text-2">{f.why}</span>
          <Button size="sm" disabled={tx.pending} onClick={() => tx.run(f.txs)} className="shrink-0">
            {f.label}
          </Button>
        </div>
      ))}
      <TxStatus {...tx} done="Sent" />
    </section>
  );
}
