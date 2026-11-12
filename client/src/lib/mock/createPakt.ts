import { me } from "./me";
import { pakts } from "./pakts";
import { getCreatedPakts, saveCreatedPakt } from "./runtimePakts";
import type { Pakt } from "./types";

export type CreatePaktInput = { name: string; open: boolean; firstDeposit: number; stopLoss: number };

export function createDemoPakt({ name, open, firstDeposit, stopLoss }: CreatePaktInput): string | false {
  if ([...getCreatedPakts(), ...pakts].some((item) => item.id === name)) return false;
  const pakt: Pakt = {
    id: name, name, open, stopLoss,
    members: [{ account: me.account, shares: firstDeposit }],
    vaultValue: firstDeposit,
    trader: null, budget: 0, budgetUsed: 0, maxPerTrade: 0, fee: 0, pnl7d: 0, pnl7dPct: 0,
  };
  const inviteToken = crypto.randomUUID();
  if (!saveCreatedPakt(pakt, inviteToken)) return false;
  me.cash = Math.max(0, me.cash - firstDeposit);
  me.paktIds = [...new Set([...me.paktIds, name])];
  return inviteToken;
}
