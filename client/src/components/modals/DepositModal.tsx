"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { me } from "@/lib/mock/me";
import { pakts } from "@/lib/mock/pakts";
import { tokens } from "@/lib/mock/tokens";

export const WALLET = "wallet";

const QUICK = ["$10", "$50", "$100", "$500"] as const;
const PAY_WITH = tokens.filter((t) => t.allowed).map((t) => t.symbol);
const select = "h-8 rounded-lg px-2 text-xs font-bold text-text outline-none focus:ring-1 focus:ring-accent";

type Props = {
  /** WALLET or a pakt id */
  to: string;
  onClose: () => void;
};

// shortcut: mock only, deposit just closes; chain call lands with wiring
export function DepositModal({ to: initialTo, onClose }: Props) {
  const [to, setTo] = useState(initialTo);
  const [token, setToken] = useState("USDC");
  const [amount, setAmount] = useState("");
  const value = Number(amount);
  const valid = amount !== "" && Number.isFinite(value) && value > 0;

  return (
    <Modal open onClose={onClose} label="Deposit">
      <h2 className="text-xl font-bold">Deposit</h2>
      <label className="mt-4 flex items-center gap-2 text-xs text-text-2">
        To
        <select value={to} onChange={(e) => setTo(e.target.value)} className={`${select} bg-panel-2`}>
          <option value={WALLET}>Wallet</option>
          {pakts
            .filter((p) => me.paktIds.includes(p.id))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </label>
      <div className="mt-3 flex h-16 items-center gap-2 rounded-xl bg-panel-2 px-4 focus-within:ring-1 focus-within:ring-accent">
        <span className="text-[28px] text-text-2">$</span>
        <input
          aria-label="Amount in USD"
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          className="min-w-0 flex-1 bg-transparent text-[28px] outline-none placeholder:text-text-3"
        />
        <select aria-label="Pay with" value={token} onChange={(e) => setToken(e.target.value)} className={`${select} bg-panel`}>
          {PAY_WITH.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <Segmented<string> options={QUICK} value={`$${amount}`} onChange={(q) => setAmount(q.slice(1))} className="mt-3" />
      <Button variant="primary" disabled={!valid} onClick={onClose} className="mt-4 h-11! w-full text-base!">
        Deposit
      </Button>
    </Modal>
  );
}
