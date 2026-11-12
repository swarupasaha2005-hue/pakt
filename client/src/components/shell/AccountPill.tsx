"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown, menuItem } from "@/components/ui/Dropdown";
import { EyeOffIcon, LogOutIcon, ShieldIcon, UserIcon } from "@/components/ui/icons";
import { Toggle } from "@/components/ui/Toggle";
import { usd } from "@/lib/format";
import { useTotal } from "@/lib/home/data";
import { useWallet } from "@/lib/near/wallet";

const row = `${menuItem} h-9`;
const icon = "size-4 shrink-0";

export function AccountPill() {
  const { accountId, ready, signIn, signOut } = useWallet();
  const { wallet, inPakts } = useTotal(accountId);
  const [open, setOpen] = useState(false);
  const [blur, setBlur] = useState(false);
  const close = () => setOpen(false);
  const toggleBlur = (on: boolean) => {
    setBlur(on);
    document.documentElement.toggleAttribute("data-blur", on);
  };

  if (!accountId) {
    return (
      // same 124x48 box as the signed-in account pill, so connecting doesn't reflow the bar
      <button
        type="button"
        disabled={!ready}
        onClick={signIn}
        className="flex h-12 w-[124px] items-center justify-center rounded-xl bg-accent text-base font-medium whitespace-nowrap text-white transition hover:brightness-110 active:scale-[0.97] disabled:opacity-60 motion-reduce:active:scale-100"
      >
        {ready ? "Connect" : "Loading…"}
      </button>
    );
  }
  const total = wallet !== undefined && inPakts !== undefined ? wallet + inPakts : undefined;

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      className="right-0 w-[218px] p-1"
      trigger={
        <button
          type="button"
          aria-expanded={open}
          aria-label="Account menu"
          onClick={() => setOpen(!open)}
          className="flex h-12 items-center gap-3 rounded-xl border px-2 py-1 text-left"
        >
          <span className="flex flex-col">
            <span data-balance className="text-base leading-6 font-medium">{total === undefined ? "…" : usd(total)}</span>
            <span className="max-w-[140px] truncate text-xs leading-4 text-text-2">{accountId}</span>
          </span>
          <Avatar name={accountId} size={32} />
        </button>
      }
    >
      <Link href={`/u/${accountId}`} onClick={close} className={row}>
        <UserIcon className={icon} /> Your profile
      </Link>
      <Link href={`/u/${accountId}?tab=pakts`} onClick={close} className={row}>
        <ShieldIcon className={icon} /> Your pakts
      </Link>
      <div className={`${row} hover:bg-transparent`}>
        <EyeOffIcon className={icon} />
        <span className="flex-1">Blur balances</span>
        <Toggle label="Blur balances" checked={blur} onChange={toggleBlur} />
      </div>
      <button type="button" onClick={() => { close(); signOut().catch(() => {}); }} className={`${row} text-down`}>
        <LogOutIcon className={icon} /> Log out
      </button>
    </Dropdown>
  );
}
