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

const DEFAULT_FEE = 20;
const field = "grid grid-cols-[1fr_10rem] items-center gap-3 text-sm text-text-2";

function candidates(pakt: Pakt) {
  const members = pakt.members.map((m) => ({
    account: m.account,
    note: "member",
    fee: traders.find((t) => t.account === m.account)?.askingFee ?? DEFAULT_FEE,
  }));
  const outsiders = traders
    .filter((t) => t.openToHire && !pakt.members.some((m) => m.account === t.account))
    .map((t) => ({ account: t.account, note: `${t.pnl["7D"] < 0 ? "-" : "+"}${compact(Math.abs(t.pnl["7D"]))} 7D`, fee: t.askingFee }));
  return [...members, ...outsiders];
}

export function ProposeTraderModal({ pakt, onClose, onSubmit }: Props) {
  const [query, setQuery] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const [budget, setBudget] = useState(500);
  const [maxPerTrade, setMaxPerTrade] = useState(50);
  const list = candidates(pakt);
  const chosen = list.find((c) => c.account === pick);

  return (
    <Modal open onClose={onClose} label={`Propose trader for ${pakt.name}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!chosen) return;
          onSubmit({
            kind: "hire",
            title: `Hire ${chosen.account} at ${chosen.fee}%`,
            change: { trader: chosen.account, fee: chosen.fee, budget, budgetUsed: 0, maxPerTrade },
          });
          onClose();
        }}
        className="flex flex-col gap-3"
      >
        <h2 className="text-xl font-semibold">Propose trader for {pakt.name}</h2>
        <Input placeholder="Search members or traders" aria-label="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div role="radiogroup" className="max-h-56 overflow-y-auto">
          {list
            .filter((c) => c.account.includes(query.toLowerCase()))
            .map((c) => (
              <label key={c.account} className="flex h-14 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-panel-2">
                <Avatar name={c.account} />
                <span className="flex-1 text-sm">
                  {c.account} <span className="text-text-2">· {c.note}</span>
                </span>
                <Badge>{c.fee}%</Badge>
                <input type="radio" name="trader" checked={pick === c.account} onChange={() => setPick(c.account)} className="accent-accent" />
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
        <p className={field}>
          Fee
          <span className="text-right">{chosen ? `${chosen.fee}%` : "—"} (asking fee) 🔒</span>
        </p>
        <Button type="submit" variant="primary" size="lg" disabled={!chosen}>
          Start vote
        </Button>
      </form>
    </Modal>
  );
}
