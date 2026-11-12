"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { usd } from "@/lib/format";
import type { Pakt } from "@/lib/mock/types";
import type { NewVote } from "@/lib/mock/votes";

export type VoteModalKind = "raise" | "fire" | "resume";

type Props = { pakt: Pakt; kind: VoteModalKind; onClose: () => void; onSubmit: (vote: NewVote) => void };

const TITLE: Record<VoteModalKind, (p: Pakt) => string> = {
  raise: () => "Raise budget",
  fire: (p) => `Fire ${p.trader}?`,
  resume: () => "Resume trading",
};

export function VoteModal({ pakt, kind, onClose, onSubmit }: Props) {
  const [budget, setBudget] = useState(pakt.budget * 2);
  const title = TITLE[kind](pakt);

  function submit() {
    onSubmit({
      kind,
      title: kind === "raise" ? `Raise budget → ${usd(budget)}` : kind === "fire" ? `Fire ${pakt.trader}` : "Resume trading",
      change: kind === "raise" ? { budget } : kind === "fire" ? { trader: null, budget: 0, budgetUsed: 0, maxPerTrade: 0, fee: 0 } : {},
    });
    onClose();
  }

  return (
    <Modal open onClose={onClose} label={title}>
      <div className="flex flex-col gap-3">
        <div>
          <h2 className={`text-xl font-semibold ${kind === "fire" ? "text-down" : ""}`}>{title}</h2>
          <p className="text-sm text-text-2">
            {pakt.trader ?? "no trader"} · {pakt.name}
          </p>
        </div>
        {kind === "raise" && (
          <label className="flex items-center gap-3 text-sm text-text-2">
            Budget <span className="text-text">{usd(pakt.budget)}</span> →
            <Input type="number" min={pakt.budget + 1} value={budget} onChange={(e) => setBudget(+e.target.value)} />
          </label>
        )}
        {kind === "fire" && <p className="text-sm text-text-2">Trading stops. Money stays in the vault. Unpaid fees are settled first.</p>}
        {kind === "resume" && <p className="text-sm text-text-2">Trading restarts with the same budget, cap and stop-loss.</p>}
        <p className="text-[13px] text-text-3">Vote ends in 3 days · needs 50%+</p>
        <Button
          variant={kind === "fire" ? "down" : "primary"}
          size="lg"
          disabled={kind === "raise" && budget <= pakt.budget}
          onClick={submit}
        >
          Start vote
        </Button>
      </div>
    </Modal>
  );
}
