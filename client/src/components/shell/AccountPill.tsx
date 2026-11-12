"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown, menuItem } from "@/components/ui/Dropdown";
import { EyeOffIcon, GearIcon, HistoryIcon, LogOutIcon, MailIcon, ShieldIcon, SlidersIcon, UserIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { usd } from "@/lib/format";
import { useTotal } from "@/lib/home/data";
import { useWallet } from "@/lib/near/wallet";

const row = `${menuItem} h-9`;
const icon = "size-4 shrink-0";

// shortcut: manage/settings/transfers/support/log out are visual only until those flows exist
const VISUAL = [
  { label: "Manage account", Icon: GearIcon },
  { label: "Settings", Icon: SlidersIcon },
  { label: "Transfers", Icon: HistoryIcon },
] as const;

export function AccountPill() {
  const { accountId, ready, signIn, signOut } = useWallet();
  const { cash, inPakts } = useTotal(accountId);
  const [open, setOpen] = useState(false);
  const [blur, setBlur] = useState(false);
  const close = () => setOpen(false);
  const toggleBlur = (on: boolean) => {
    setBlur(on);
    document.documentElement.toggleAttribute("data-blur", on);
  };

  if (!accountId) {
    return (
      <Button variant="primary" size="lg" disabled={!ready} onClick={signIn} className="h-12">
        {ready ? "Connect wallet" : "Loading…"}
      </Button>
    );
  }
  const total = cash !== undefined && inPakts !== undefined ? cash + inPakts : undefined;

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
          className="flex h-12 items-center gap-6 rounded-xl border bg-panel pr-2 pl-2.5 text-left"
        >
          <span className="flex flex-col">
            <span data-balance className="text-sm leading-5">{total === undefined ? "…" : usd(total)}</span>
            <span className="max-w-[140px] truncate text-xs leading-5 text-text-2">{accountId}</span>
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
      {VISUAL.map(({ label, Icon }) => (
        <button key={label} type="button" onClick={close} className={row}>
          <Icon className={icon} /> {label}
        </button>
      ))}
      <div className={`${row} hover:bg-transparent`}>
        <EyeOffIcon className={icon} />
        <span className="flex-1">Blur balances</span>
        <Toggle label="Blur balances" checked={blur} onChange={toggleBlur} />
      </div>
      <button type="button" onClick={close} className={row}>
        <MailIcon className={icon} /> Contact support
      </button>
      <button type="button" onClick={() => { close(); signOut().catch(() => {}); }} className={`${row} text-down`}>
        <LogOutIcon className={icon} /> Log out
      </button>
    </Dropdown>
  );
}
