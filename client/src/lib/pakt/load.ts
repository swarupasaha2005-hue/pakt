"use client";

// Everything the pakt page shows: factory entry, vault state, holders, prices, DAO proposals and the indexed feed.
import { useCallback, useEffect, useRef, useState } from "react";
import { paktFeed, type PaktEvent } from "../api";
import {
  getHolders, getLastProposalId, getPakt, getPolicy, getPrices, getProposals, getState, vaultValue,
  type FactoryPakt, type Holder, type Policy, type PriceData, type Proposal, type VaultState,
} from "../near/contracts";
import { useStream } from "../stream";

export type PaktData = {
  info: FactoryPakt; state: VaultState; holders: [string, Holder][]; prices: PriceData;
  /** usd e6; null when a held token has no fresh price */
  value: bigint | null;
  proposals: Proposal[]; policy: Policy;
  /** newest first */
  events: PaktEvent[];
};

async function fetchPakt(name: string): Promise<PaktData | null> {
  const info = await getPakt(name);
  if (!info) return null;
  const { vault, dao } = info;
  const [state, holders, policy, last, feed] = await Promise.all([
    getState(vault),
    getHolders(vault, 0, 200),
    getPolicy(dao),
    getLastProposalId(dao),
    // shortcut: newest 100 events only, page with `before` if pakts get busy
    paktFeed(vault, { limit: 100 }).catch(() => ({ items: [] as PaktEvent[] })),
  ]);
  const [prices, proposals] = await Promise.all([getPrices(state.balances.map(([t]) => t)), getProposals(dao, Math.max(0, last - 50), 50)]);
  return { info, state, holders, prices, value: vaultValue(state, prices), proposals, policy, events: feed.items };
}

/** data: undefined while loading, null for an unknown name. reload() after txs; stream events reload too */
export function usePakt(name: string) {
  const [data, setData] = useState<PaktData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const vault = useRef<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const d = await fetchPakt(name);
      vault.current = d?.info.vault ?? null;
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [name]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after an await, not synchronously
    reload();
  }, [reload]);

  useStream((e) => {
    if (e.vault === vault.current) reload();
  });

  /** after a tx: now, then again once `final` views catch up */
  const refresh = useCallback(() => {
    reload();
    setTimeout(reload, 3_000);
  }, [reload]);

  return { data, error, reload, refresh };
}

/** wall clock that ticks every 30s, for countdowns */
export function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}
