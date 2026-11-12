"use client";

import { useEffect, useState } from "react";
import { TxStatus } from "@/components/pakt/TxStatus";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { usd } from "@/lib/format";
import { leave, sharesValue, storageBalanceOf, type Tx, type VaultState } from "@/lib/near/contracts";
import { useWallet } from "@/lib/near/wallet";
import { registerFt, useTx } from "@/lib/pakt/tx";
import { amount, e6 } from "@/lib/pakt/units";

const PORTIONS = ["25%", "50%", "100%"] as const;

type Props = {
  name: string;
  vault: string;
  state: VaultState;
  /** your raw shares */
  shares: string;
  /** vault usd e6, null without prices */
  value: bigint | null;
  onClose: () => void;
  onDone: () => void;
};

/** burn shares for a pro-rata slice of every token, in kind; fees above the mark are settled first */
export function LeavePaktModal({ name, vault, state, shares, value, onClose, onDone }: Props) {
  const { accountId } = useWallet();
  const [portion, setPortion] = useState<(typeof PORTIONS)[number]>("100%");
  const [unregistered, setUnregistered] = useState<string[]>([]);
  const tx = useTx(onDone);

  const burn = ((BigInt(shares) * BigInt(parseInt(portion))) / BigInt(100)).toString();
  const total = BigInt(state.total_shares);
  const payouts = state.balances
    .map(([token, bal]) => [token, ((BigInt(bal) * BigInt(burn)) / total).toString()] as const)
    .filter(([, a]) => a !== "0");
  const parked = state.at_dex.some(([, a]) => a !== "0");
  const blocked = state.op || state.draining ? "Vault busy, retry in a minute" : parked && !state.dex_synced ? "Funds stuck at the dex: recover first" : burn === "0" ? "Nothing to leave" : null;

  useEffect(() => {
    if (!accountId) return;
    // payouts to tokens you are not registered on park as owed; register them in the same prompt
    Promise.all(state.balances.map(([t]) => storageBalanceOf(t, accountId).then((b) => (b ? null : t))))
      .then((ts) => setUnregistered(ts.filter((t): t is string => t !== null)))
      .catch(() => {});
  }, [accountId, state.balances]);

  const rows = [
    ["Your share", `${((Number(burn) / Number(total)) * 100).toFixed(1)}%`],
    ["Value", value === null ? "—" : usd(e6(sharesValue(burn, state, value)))],
    ...payouts.map(([t, a]) => ["You receive", `≈ ${amount(t, a)}`]),
  ];
  const submit = () => {
    const regs: Tx[] = accountId ? payouts.filter(([t]) => unregistered.includes(t)).map(([t]) => registerFt(t, accountId)) : [];
    tx.run([...regs, ...leave(vault, burn)]);
  };
  const done = !!tx.hash && !tx.error;

  return (
    <Modal open onClose={onClose} label={`Leave ${name}?`}>
      <h2 className="text-xl font-bold">Leave {name}?</h2>
      <Segmented options={PORTIONS} value={portion} onChange={setPortion} className="mt-3" />
      <dl className="my-4 space-y-2 text-xs">
        {rows.map(([k, v], i) => (
          <div key={i} className="flex justify-between">
            <dt className="text-text-2">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mb-3 text-xs text-text-3">
        Profit above the high-water mark pays its fees first, so amounts can be a little lower.
        {payouts.some(([t]) => unregistered.includes(t)) && " Includes token registration (0.00125 NEAR each)."}
      </p>
      {done ? (
        <Button size="lg" className="w-full" onClick={onClose}>
          Close
        </Button>
      ) : (
        <Button variant="down-outline" size="lg" className="w-full" disabled={!!blocked || tx.pending} onClick={submit}>
          {tx.pending ? "Confirm in wallet…" : (blocked ?? `Leave with ${portion}`)}
        </Button>
      )}
      <TxStatus {...tx} done="Left" />
    </Modal>
  );
}
