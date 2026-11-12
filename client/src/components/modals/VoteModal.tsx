"use client";

import { useState } from "react";
import { TxStatus } from "@/components/pakt/TxStatus";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { usd } from "@/lib/format";
import { proposeCap, proposeFire, proposeResume, type Trader } from "@/lib/near/contracts";
import { useTx } from "@/lib/pakt/tx";
import { e6, toRaw } from "@/lib/pakt/units";

export type VoteModalKind = "raise" | "fire" | "resume";

type Props = { kind: VoteModalKind; trader: Trader | null; name: string; vault: string; dao: string; onClose: () => void; onDone: () => void };

const TITLE: Record<VoteModalKind, (t: Trader | null) => string> = {
  raise: () => "Set budget",
  fire: (t) => `Fire ${t?.account}?`,
  resume: () => "Resume trading",
};

/** starts a DAO proposal; the vault runs set_cap / fire / resume once it passes */
export function VoteModal({ kind, trader, name, vault, dao, onClose, onDone }: Props) {
  const [budget, setBudget] = useState(trader ? String(e6(trader.budget) * 2) : "");
  const [maxPerTrade, setMaxPerTrade] = useState(trader ? String(e6(trader.max_per_trade)) : "");
  const tx = useTx(onDone);
  const title = TITLE[kind](trader);
  const b = toRaw(budget, 6);
  const m = toRaw(maxPerTrade, 6);
  const blocked = !trader
    ? "No trader"
    : kind === "resume" && !trader.paused
      ? "Trader is not paused"
      : kind === "raise" && (!b || !m)
        ? "Set budget and max per trade"
        : kind === "raise" && BigInt(m!) > BigInt(b!)
          ? "Max per trade over budget"
          : null;

  function submit() {
    if (blocked) return;
    const txs =
      kind === "raise"
        ? proposeCap(dao, vault, b!, m!, `set budget ${usd(Number(budget))}, max ${usd(Number(maxPerTrade))}`)
        : kind === "fire"
          ? proposeFire(dao, vault, `fire ${trader?.account}`)
          : proposeResume(dao, vault);
    tx.run(txs);
  }
  const done = !!tx.hash && !tx.error;

  return (
    <Modal open onClose={onClose} label={title}>
      <div className="flex flex-col gap-3">
        <div>
          <h2 className={`text-xl font-bold ${kind === "fire" ? "text-down" : ""}`}>{title}</h2>
          <p className="text-xs text-text-2">
            {trader?.account ?? "no trader"} · {name}
          </p>
        </div>
        {kind === "raise" && trader && (
          <>
            <label className="flex items-center gap-3 text-xs text-text-2">
              Budget <span className="text-text">{usd(e6(trader.budget))}</span> →
              <Input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))} />
            </label>
            <label className="flex items-center gap-3 text-xs text-text-2">
              Max/trade <span className="text-text">{usd(e6(trader.max_per_trade))}</span> →
              <Input inputMode="decimal" value={maxPerTrade} onChange={(e) => setMaxPerTrade(e.target.value.replace(/[^\d.]/g, ""))} />
            </label>
            <p className="text-xs text-text-2">New caps reset budget used. More room restarts the trade delay.</p>
          </>
        )}
        {kind === "fire" && <p className="text-xs text-text-2">Trading stops. Money stays in the vault. Unpaid fees are settled first.</p>}
        {kind === "resume" && <p className="text-xs text-text-2">Trading restarts with the same budget, cap and stop-loss.</p>}
        <p className="text-xs text-text-3">Vote ends in 1 day · needs 50%+ · 0.1 NEAR bond, returned when it closes</p>
        {done ? (
          <Button size="lg" onClick={onClose}>
            Close
          </Button>
        ) : (
          <Button variant={kind === "fire" ? "down" : "primary"} size="lg" disabled={!!blocked || tx.pending} onClick={submit}>
            {tx.pending ? "Confirming…" : (blocked ?? "Start vote")}
          </Button>
        )}
        <TxStatus {...tx} done="Vote started" />
      </div>
    </Modal>
  );
}
