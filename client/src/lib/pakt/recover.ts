import { dexRecover, finishFire, LOCK_TTL_MS, reconcile, syncMember, unlock, type Tx, type VaultState } from "@/lib/near/contracts";

export type Fix = { label: string; why: string; txs: Tx[] };

const some = (rows: [string, string][]) => rows.filter(([, a]) => a !== "0").map(([t]) => t);

/** stuck-vault fixes anyone can run, most urgent first; empty when the vault is healthy */
export function recoveries(vault: string, s: VaultState, now: number, account: string | null, pendingSync: string[]): Fix[] {
  const out: Fix[] = [];
  const stale = !!s.op && now >= s.op_since_ms + LOCK_TTL_MS;
  if (stale) out.push({ label: "Unlock vault", why: `${s.op} has been stuck over 10 minutes`, txs: unlock(vault) });
  const idle = !s.op;
  if (idle && s.fire_pending) out.push({ label: "Finish fire", why: "The DAO fired the pakter but the payout didn't run", txs: finishFire(vault) });
  // funds at ref only need a recover when the ledger lost track or leavers hold ious there
  const atDex = !s.dex_synced ? some(s.at_dex) : [];
  for (const t of new Set([...atDex, ...some(s.dex_iou)]))
    if (idle) out.push({ label: "Recover from Ref", why: `${t.split(".")[0]} is parked at the dex`, txs: dexRecover(vault, t) });
  for (const t of some(s.suspense)) if (idle) out.push({ label: "Reconcile", why: `${t.split(".")[0]} arrived outside the ledger`, txs: reconcile(vault, t) });
  if (account && pendingSync.includes(account))
    out.push({ label: "Retry DAO sync", why: "Your DAO membership didn't register. Needs a refundable bond", txs: syncMember(vault, account) });
  return out;
}
