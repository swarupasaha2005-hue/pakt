"use client";

import { useState } from "react";
import { CreatePaktModal } from "@/components/modals/CreatePaktModal";
import { DepositModal, WALLET } from "@/components/modals/DepositModal";
import { Dropdown, menuItem } from "@/components/ui/Dropdown";
import { DollarIcon, PlusCircleIcon, SwapIcon } from "@/components/ui/icons";
import { requestTokens } from "@/lib/api";
import { usd } from "@/lib/format";
import { useTotal } from "@/lib/home/data";
import { useWallet } from "@/lib/near/wallet";
import { FAUCET } from "./Ticker";

const money = (n: number | undefined) => (n === undefined ? "…" : usd(n));

/** top-bar "Create pakt" pill; click opens the cash card with create + deposit */
export function CashPill() {
  const { accountId, signIn } = useWallet();
  const { cash, inPakts, holdings } = useTotal(accountId);
  const [open, setOpen] = useState(false);
  const [drip, setDrip] = useState<string | null>(null); // faucet status line
  const claim = async () => {
    if (!accountId) return signIn();
    setDrip("Sending test tokens…");
    try {
      await requestTokens(accountId);
      setDrip("Sent 1,000 tUSDC, 0.01 tBTC, 50 tNEAR");
    } catch (e) {
      setDrip((e as Error).message);
    }
  };
  const [modal, setModal] = useState<{ deposit: string } | "create" | null>(null);
  const pick = (m: typeof modal) => {
    setOpen(false);
    if (!accountId && m !== "create") return signIn(); // create shows its own connect step
    setModal(m);
  };
  const shown = accountId ? cash : 0;
  const firstPakt = holdings?.[0]?.pakt.name;

  return (
    <>
      <Dropdown
        open={open}
        onOpenChange={setOpen}
        className="right-0 w-[302px] px-3 pt-3 pb-1"
        trigger={
          <button
            type="button"
            aria-expanded={open}
            data-tour="create"
            aria-label="Cash and create pakt"
            onClick={() => setOpen(!open)}
            className="flex h-12 items-center rounded-xl border px-3 text-base font-medium whitespace-nowrap transition hover:bg-panel-2"
          >
            Create pakt
          </button>
        }
      >
        <dl className="flex flex-col gap-1 text-sm leading-5">
          <div className="flex justify-between">
            <dt>Wallet cash</dt>
            <dd data-balance>{money(shown)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>In pakts</dt>
            <dd data-balance>{money(accountId ? inPakts : 0)}</dd>
          </div>
        </dl>
        {firstPakt && (
          <button type="button" onClick={() => pick({ deposit: firstPakt })} className="mt-1.5 flex items-center gap-2 text-xs font-medium text-accent hover:brightness-125">
            <SwapIcon className="size-4" /> Move to a pakt
          </button>
        )}
        <div className="mt-3 border-t pt-1">
          <button type="button" onClick={() => pick("create")} className={`${menuItem} -mx-2 h-10`}>
            <PlusCircleIcon className="size-4" /> Create pakt
          </button>
          <div className="relative">
            <button type="button" onClick={() => pick({ deposit: WALLET })} className={`${menuItem} -mx-2 h-10`}>
              <DollarIcon className="size-4" /> Deposit
            </button>
            <button
              type="button"
              onClick={claim}
              className="absolute top-1/2 right-0 -translate-y-1/2 rounded-md bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent hover:bg-accent/25"
            >
              Request test tokens
            </button>
          </div>
          {drip && <p className="-mt-1 pb-2 pl-6 text-xs text-text-2">{drip}</p>}
          <a href={FAUCET} target="_blank" rel="noopener noreferrer" className={`${menuItem} -mx-2 h-10`}>
            <PlusCircleIcon className="size-4" /> Get testnet NEAR
          </a>
        </div>
      </Dropdown>
      {modal === "create" && <CreatePaktModal onClose={() => setModal(null)} />}
      {modal && modal !== "create" && <DepositModal to={modal.deposit} onClose={() => setModal(null)} />}
    </>
  );
}
