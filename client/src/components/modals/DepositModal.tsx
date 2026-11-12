"use client";

import { useEffect, useState } from "react";
import { TxStatus } from "@/components/pakt/TxStatus";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { pakts } from "@/lib/api";
import { BASE_TOKEN, vaultId } from "@/lib/config";
import { usd } from "@/lib/format";
import { LOGOS } from "@/lib/home/data";
import { deposit, ftBalanceOf, getHolder, getState, type Holder, type VaultState } from "@/lib/near/contracts";
import { useWallet } from "@/lib/near/wallet";
import { useTx } from "@/lib/pakt/tx";
import { fromRaw, toRaw } from "@/lib/pakt/units";

export const WALLET = "wallet";

/** vault refunds first deposits under $5 */
const MIN_USD = 5;
const QUICK = ["$10", "$50", "$100", "$500"] as const;
const select = "h-8 rounded-lg px-2 text-sm font-medium text-text outline-none focus:ring-1 focus:ring-accent";

type Props = {
  /** WALLET (pick a pakt) or a pakt name */
  to: string;
  onClose: () => void;
  /** after a sent deposit, to refresh views */
  onDone?: () => void;
};

type Target = { state: VaultState; holder: Holder | null; cash: string };

/** storage_deposit + base token ft_transfer_call into the vault; the vault refunds what it refuses */
export function DepositModal({ to: initialTo, onClose, onDone }: Props) {
  const { accountId, signIn } = useWallet();
  const [to, setTo] = useState(initialTo);
  const [names, setNames] = useState<string[]>(initialTo === WALLET ? [] : [initialTo]);
  const [target, setTarget] = useState<Target | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const tx = useTx(onDone);
  const vault = to === WALLET ? null : vaultId(to);

  useEffect(() => {
    pakts({ limit: 100 })
      .then((p) => setNames((n) => [...new Set([...n, ...p.items.flatMap((r) => (r.info.name ? [r.info.name] : []))])]))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!vault || !accountId) return;
    let dead = false;
    Promise.all([getState(vault), getHolder(vault, accountId), ftBalanceOf(BASE_TOKEN.id, accountId)])
      .then(([state, holder, cash]) => !dead && (setTarget({ state, holder, cash }), setLoadError(null)))
      .catch((e: Error) => !dead && setLoadError(e.message));
    return () => {
      dead = true;
    };
  }, [vault, accountId, tx.hash]);

  const raw = toRaw(amount, BASE_TOKEN.decimals);
  const min = Math.max(MIN_USD, target ? fromRaw(target.state.min_deposit, BASE_TOKEN.decimals) : MIN_USD);
  const cash = target ? fromRaw(target.cash, BASE_TOKEN.decimals) : 0;
  const blocked = !accountId
    ? null
    : !vault
      ? "Pick a pakt"
      : loadError
        ? loadError
        : !target
          ? "Loading…"
          : !target.holder?.member && target.state.join_mode === "Invite"
            ? "Invite only"
            : !target.holder?.member && target.state.members >= 100
              ? "Pakt full"
              : target.state.op || target.state.draining
                ? "Vault busy, retry in a minute"
                : !raw
                  ? "Enter amount"
                  : Number(amount) < min
                    ? `Min deposit ${usd(min)}`
                    : BigInt(raw) > BigInt(target.cash)
                      ? `Not enough ${BASE_TOKEN.symbol}`
                      : null;
  const done = !!tx.hash && !tx.error;

  return (
    <Modal open onClose={onClose} label="Deposit">
      <h2 className="text-lg font-medium">Deposit</h2>
      <label className="mt-4 flex items-center gap-2 text-sm font-medium text-text-2">
        To
        <select
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setTarget(null);
          }}
          className={`${select} bg-panel-2`}
        >
          {initialTo === WALLET && <option value={WALLET}>Pick a pakt</option>}
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 flex h-16 items-center gap-2 rounded-xl bg-panel-2 px-4 focus-within:ring-1 focus-within:ring-accent">
        <span className="text-[28px] font-medium text-text-2">$</span>
        <input
          aria-label={`Amount in ${BASE_TOKEN.symbol}`}
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          className="min-w-0 flex-1 bg-transparent text-[28px] font-medium outline-none placeholder:text-text-3"
        />
        <span className={`${select} flex items-center gap-1.5 bg-panel`}>
          <Avatar name={BASE_TOKEN.symbol} src={LOGOS[BASE_TOKEN.symbol]} size={18} />
          {BASE_TOKEN.symbol}
        </span>
      </div>
      <Segmented<string> options={QUICK} value={`$${amount}`} onChange={(q) => setAmount(q.slice(1))} className="mt-3" />
      <p className="mt-3 text-xs text-text-2">
        {accountId && target && `Wallet: ${cash.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${BASE_TOKEN.symbol} · `}
        Min {usd(min)} · plus 0.01 NEAR vault storage (excess refunded)
      </p>
      {!accountId ? (
        <Button variant="primary" onClick={signIn} className="mt-4 h-11! w-full text-sm! font-medium!">
          Connect wallet
        </Button>
      ) : done ? (
        <Button variant="primary" onClick={onClose} className="mt-4 h-11! w-full text-sm! font-medium!">
          Close
        </Button>
      ) : (
        <Button
          variant="primary"
          disabled={!!blocked || tx.pending}
          onClick={() => vault && raw && tx.run(deposit(vault, raw))}
          className="mt-4 h-11! w-full text-sm! font-medium!"
        >
          {tx.pending ? "Confirm in wallet…" : (blocked ?? "Deposit")}
        </Button>
      )}
      <TxStatus {...tx} done="Deposited" />
    </Modal>
  );
}
