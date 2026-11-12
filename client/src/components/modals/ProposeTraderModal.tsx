"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { compact } from "@/lib/format";
import { traders } from "@/lib/mock/traders";
import type { Pakt } from "@/lib/mock/types";
import type { NewVote } from "@/lib/mock/votes";

type Props = { pakt: Pakt; onClose: () => void; onSubmit: (vote: NewVote) => void };

const field = "grid grid-cols-[1fr_10rem] items-center gap-3 text-xs text-text-2";

function candidates(pakt: Pakt) {
  const members = pakt.members.map((member) => member.account);
  const accounts = [...new Set([...members, ...traders.map((trader) => trader.account)])];

  return accounts.map((account) => {
    const trader = traders.find((item) => item.account === account);
    const isMember = members.includes(account);
    const canPropose = Boolean(trader?.openToHire && trader.askingFee);

    return {
      account,
      note: isMember ? "member" : trader ? `${trader.pnl["7D"] < 0 ? "-" : "+"}${compact(Math.abs(trader.pnl["7D"]))} 7D` : "member",
      fee: trader?.askingFee ?? null,
      canPropose,
      unavailableReason: !trader?.askingFee ? "No asking fee" : !trader.openToHire ? "Not taking pakts" : null,
    };
  });
}

export function ProposeTraderModal({ pakt, onClose, onSubmit }: Props) {
  const [query, setQuery] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const [budget, setBudget] = useState(500);
  const [maxPerTrade, setMaxPerTrade] = useState(50);
  const [stopLoss, setStopLoss] = useState(pakt.stopLoss);
  const list = candidates(pakt);
  const chosen = list.find((c) => c.account === pick);

  if (pakt.vaultValue <= 0) {
    return (
      <Modal open onClose={onClose} label={`Propose trader for ${pakt.name}`}>
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">Deposit first</h2>
          <p className="text-xs text-text-2">Add funds to {pakt.name} before proposing a trader.</p>
          <Button onClick={onClose} size="lg">Close</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} label={`Propose trader for ${pakt.name}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!chosen || !chosen.canPropose || chosen.fee === null) return;
          onSubmit({
            kind: "hire",
            title: `Hire ${chosen.account} at ${chosen.fee}%`,
            change: { trader: chosen.account, fee: chosen.fee, budget, budgetUsed: 0, maxPerTrade, stopLoss },
          });
          onClose();
        }}
        className="flex flex-col gap-3"
      >
        <h2 className="text-xl font-bold">Propose trader for {pakt.name}</h2>
        <Input placeholder="Search members or traders" aria-label="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div role="radiogroup" className="max-h-56 overflow-y-auto">
          {list
            .filter((c) => c.account.toLowerCase().includes(query.toLowerCase()))
            .map((c) => (
              <label key={c.account} className={`flex h-14 items-center gap-3 rounded-xl px-2 ${c.canPropose ? "cursor-pointer hover:bg-panel-2" : "cursor-not-allowed opacity-60"}`}>
                <Avatar name={c.account} />
                <span className="flex-1 text-xs">
                  {c.account} <span className="text-text-2">· {c.note}</span>
                  {!c.canPropose && <span className="block text-text-3">{c.unavailableReason}</span>}
                </span>
                <Badge tone={c.canPropose ? "accent" : "neutral"}>{c.fee === null ? "No fee" : `${c.fee}%`}</Badge>
                <input type="radio" name="trader" checked={pick === c.account} disabled={!c.canPropose} onChange={() => setPick(c.account)} className="accent-accent" />
              </label>
            ))}
        </div>
        <label className={field}>
          Budget $
          <Input type="number" min={1} required value={budget} onChange={(e) => setBudget(+e.target.value)} />
        </label>
        <label className={field}>
          Max per trade $
          <Input type="number" min={1} max={budget} required value={maxPerTrade} onChange={(e) => setMaxPerTrade(+e.target.value)} />
        </label>
        <label className={field}>
          Stop-loss %
          <Input type="number" min={5} max={90} required value={stopLoss} onChange={(e) => setStopLoss(Number(e.target.value))} />
        </label>
        <p className={field}>
          Fee
          <span className="text-right">{chosen?.canPropose ? `${chosen.fee}% (asking fee) 🔒` : "—"}</span>
        </p>
        <Button type="submit" variant="primary" size="lg" disabled={!chosen?.canPropose}>
          Start vote
        </Button>
      </form>
    </Modal>
  );
}
