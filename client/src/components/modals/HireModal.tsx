"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { loadPakts, useLoad, type PaktInfo } from "@/lib/home/data";
import { daoMembers, getPakt, getPolicy } from "@/lib/near/contracts";
import { ProposeTraderModal } from "./ProposeTraderModal";

type Props = { trader: string; account: string; onClose: () => void };

/** pakts this account votes in that have no trader or open offer */
async function hiring(account: string): Promise<(PaktInfo & { stopLossBps: number })[]> {
  const open = (await loadPakts()).filter((p) => !p.state.trader && !p.state.offer);
  const rows = await Promise.all(
    open.map(async (p) => {
      const [policy, f] = await Promise.all([getPolicy(p.state.dao), getPakt(p.name)]);
      return daoMembers(policy).includes(account) ? { ...p, stopLossBps: f?.stop_loss_bps ?? 1000 } : null;
    }),
  );
  return rows.filter((r) => r !== null);
}

/** leaderboard "Hire": pick one of your pakts, then propose this trader to its DAO */
export function HireModal({ trader, account, onClose }: Props) {
  const { data, error } = useLoad(() => hiring(account), [account]);
  const [pick, setPick] = useState<(PaktInfo & { stopLossBps: number }) | null>(null);

  if (pick)
    return (
      <ProposeTraderModal
        name={pick.name} vault={pick.vault} dao={pick.state.dao} members={[]} stopLossBps={pick.stopLossBps} trader={trader}
        onClose={onClose} onDone={() => {}}
      />
    );
  return (
    <Modal open onClose={onClose} label={`Hire ${trader}`}>
      <h2 className="text-lg font-medium">Hire {trader}</h2>
      <p className="mt-1 text-sm text-text-2">Pick a pakt you vote in. Members approve the offer, then the pakter accepts.</p>
      <div className="mt-4 space-y-1">
        {!data && !error && [0, 1].map((i) => <Skeleton key={i} className="h-12" />)}
        {error && <p className="py-6 text-center text-sm text-text-2">Could not load your pakts</p>}
        {data && !data.length && <p className="py-6 text-center text-sm text-text-2">None of your pakts is hiring. Create one, or fire the current pakter first.</p>}
        {data?.map((p) => (
          <button key={p.vault} type="button" onClick={() => setPick(p)} className="flex h-12 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-panel-2">
            <Avatar name={p.name} size={28} />
            <span className="flex-1 text-sm font-medium">{p.name}</span>
            <span className="text-xs text-text-2">{p.members} members</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
