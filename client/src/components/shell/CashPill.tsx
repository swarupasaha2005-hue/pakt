"use client";

import { useState } from "react";
import { DepositModal, WALLET } from "@/components/modals/DepositModal";
import { Dropdown, menuItem } from "@/components/ui/Dropdown";
import { BankIcon, PlusCircleIcon, SwapIcon } from "@/components/ui/icons";
import { usd } from "@/lib/format";
import { useTotal } from "@/lib/home/data";
import { useWallet } from "@/lib/near/wallet";

const money = (n: number | undefined) => (n === undefined ? "…" : usd(n));

export function CashPill() {
  const { accountId } = useWallet();
  const { cash, inPakts, holdings } = useTotal(accountId);
  const [open, setOpen] = useState(false);
  const [depositTo, setDepositTo] = useState<string | null>(null);
  const deposit = (to: string) => {
    setOpen(false);
    setDepositTo(to);
  };
  if (!accountId) return null;
  const firstPakt = holdings?.[0]?.pakt.name;

  return (
    <>
      <Dropdown
        open={open}
        onOpenChange={setOpen}
        className="left-1/2 w-[302px] -translate-x-1/2 px-3 pt-3 pb-1"
        trigger={
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="flex h-12 flex-col justify-center rounded-xl border bg-panel px-2.5 text-left"
          >
            <span className="text-sm leading-5">
              <span data-balance>{money(cash)}</span> <span className="text-text-3">tUSDC</span>
            </span>
            <span className="text-xs leading-4 font-bold text-accent">Deposit more</span>
          </button>
        }
      >
        <dl className="flex flex-col gap-1 text-sm leading-5">
          <div className="flex justify-between">
            <dt>Wallet cash</dt>
            <dd data-balance>{money(cash)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>In pakts</dt>
            <dd data-balance>{money(inPakts)}</dd>
          </div>
        </dl>
        {firstPakt && (
          <button type="button" onClick={() => deposit(firstPakt)} className="mt-1.5 flex items-center gap-2 text-xs font-medium text-accent hover:brightness-125">
            <SwapIcon className="size-4" /> Move to a pakt
          </button>
        )}
        <div className="mt-3 border-t pt-1">
          <button type="button" onClick={() => deposit(WALLET)} className={`${menuItem} -mx-2 h-10`}>
            <PlusCircleIcon className="size-4" /> Deposit
          </button>
          {/* shortcut: withdraw is visual only, flow lands with chain wiring */}
          <button type="button" onClick={() => setOpen(false)} className={`${menuItem} -mx-2 h-10`}>
            <BankIcon className="size-4" /> Withdraw
          </button>
        </div>
      </Dropdown>
      {depositTo && <DepositModal to={depositTo} onClose={() => setDepositTo(null)} />}
    </>
  );
}
