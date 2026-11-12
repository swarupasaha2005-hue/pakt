"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { CreatePaktModal } from "@/components/modals/CreatePaktModal";
import { useMockSession } from "@/components/session/MockSessionProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Pct } from "@/components/ui/Pct";
import { Segmented } from "@/components/ui/Segmented";
import { compact, signed } from "@/lib/format";
import { me } from "@/lib/mock/me";
import { pakts } from "@/lib/mock/pakts";
import { getAllPakts, subscribeCreatedPakts } from "@/lib/mock/runtimePakts";
import { createDemoPakt } from "@/lib/mock/createPakt";

const CHIPS = ["All", "Open to join", "Mine", "Hiring"] as const;
type Chip = (typeof CHIPS)[number];

const VIEW: Record<Chip, (p: (typeof pakts)[number]) => boolean> = {
  All: () => true,
  "Open to join": (p) => p.open && !me.paktIds.includes(p.id),
  Mine: (p) => me.paktIds.includes(p.id),
  Hiring: (p) => !p.trader,
};

export function PaktsTab() {
  const [chip, setChip] = useState<Chip>("All");
  const [creating, setCreating] = useState(false);
  const createdPakts = useSyncExternalStore(subscribeCreatedPakts, getAllPakts, () => pakts);
  const pathname = usePathname();
  const { connected, requestConnect } = useMockSession();
  const visiblePakts = createdPakts.filter((pakt) => chip === "Mine" && !connected ? false : VIEW[chip](pakt));


  return (
    <>
      <Segmented options={CHIPS} value={chip} onChange={setChip} className="px-3 pt-1.5 pb-2" />
      <ul className="flex-1 space-y-1 overflow-y-auto px-2">
        <li>
          <button
            type="button"
            onClick={() => connected ? setCreating(true) : requestConnect()}
            className="mb-1 flex h-11 w-full items-center gap-2 rounded-xl bg-pink/10 px-3 text-sm font-bold text-pink hover:bg-pink/15"
          >
            <span className="text-lg leading-none">+</span> {connected ? "Create your pakt" : "Connect to create a pakt"}
            <span className="ml-auto text-lg leading-none">›</span>
          </button>
        </li>
        {visiblePakts.map((p) => (
          <li key={p.id}>
            <Link
              href={`/pakt/${p.id}`}
              className={`flex h-16 items-center gap-3 rounded-xl px-2 transition-colors ${pathname === `/pakt/${p.id}` ? "bg-panel-2" : "hover:bg-panel-2/60"}`}
            >
              <Avatar name={p.name} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm leading-5">{p.name}</span>
                <span className="truncate text-xs leading-5 text-text-2">
                  {p.members.length} members · {compact(p.vaultValue)} vault
                </span>
                <span className="flex items-center gap-1 truncate text-xs leading-4 text-text-2">
                  {p.trader ? <>trader <Avatar name={p.trader} size={14} /> {p.trader} · {p.fee}%</> : <Badge tone="neutral">Hiring</Badge>}
                </span>
              </span>
              <span className="flex flex-col items-end self-start pt-2.5">
                <span className={`text-sm leading-5 ${p.pnl7d < 0 ? "text-down" : "text-up"}`}>
                  {signed(p.pnl7d)}
                </span>
                <Pct value={p.pnl7dPct} className="text-xs leading-5" />
              </span>
            </Link>
          </li>
        ))}
        {visiblePakts.length === 0 && (
          <li className="space-y-2 rounded-xl border border-dashed p-3">
            <p className="px-1 text-xs text-text-2">No pakts here yet. Pick a first move.</p>
            <Link href="/token/NEAR" className="block rounded-lg bg-panel-2 p-3 text-sm hover:bg-border">
              <span className="block font-bold">Trade solo</span>
              <span className="text-xs text-text-2">Start with your own vault.</span>
            </Link>
            <button type="button" onClick={() => connected ? setCreating(true) : requestConnect()} className="block w-full rounded-lg bg-panel-2 p-3 text-left text-sm hover:bg-border">
              <span className="block font-bold">{connected ? "Create a pakt" : "Connect to create a pakt"}</span>
              <span className="text-xs text-text-2">Set the rules with friends.</span>
            </button>
            <Link href={`/pakt/${pakts.find((p) => p.open)?.id ?? "degens"}`} className="block rounded-lg bg-panel-2 p-3 text-sm hover:bg-border">
              <span className="block font-bold">Join a pakt</span>
              <span className="text-xs text-text-2">Browse open groups.</span>
            </Link>
          </li>
        )}
      </ul>
      {creating && <CreatePaktModal onClose={() => setCreating(false)} onCreate={createDemoPakt} />}
    </>
  );
}
