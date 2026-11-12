"use client";

// One wallet round trip with pending / error / hash state; vault refusals come back as logs, so they count as errors.
import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
import { actionCreators } from "@near-js/transactions";
import { useState } from "react";
import { useWallet } from "../near/wallet";
import type { Tx } from "../near/contracts";

/** vault logs that mean "nothing happened" (refunds, refused trades, ...) */
const REFUSAL = /^(refund|trade refused|busy|accept failed|settle skipped|dex withdraw failed): /;

/** first panic or vault refusal in the outcomes, else null */
export function txProblem(outs: FinalExecutionOutcome[]): string | null {
  for (const o of outs) {
    for (const r of [o.transaction_outcome, ...o.receipts_outcome]) {
      const st = r?.outcome.status;
      if (typeof st === "object" && st.Failure) {
        const s = JSON.stringify(st.Failure);
        return s.match(/ExecutionError":"(?:Smart contract panicked: )?([^"]+)/)?.[1] ?? s;
      }
      const log = r?.outcome.logs.find((l) => REFUSAL.test(l));
      if (log) return log;
    }
  }
  return null;
}

export type TxState = { pending: boolean; error: string | null; hash: string | null };

/** run(txs) resolves true on success; onDone fires after every settled send so views refresh */
export function useTx(onDone?: () => void) {
  const { signAndSend } = useWallet();
  const [s, set] = useState<TxState>({ pending: false, error: null, hash: null });
  async function run(txs: Tx[]) {
    set({ pending: true, error: null, hash: null });
    try {
      const outs = await signAndSend(txs);
      const error = txProblem(outs);
      set({ pending: false, error, hash: outs.at(-1)?.transaction?.hash ?? null });
      onDone?.();
      return !error;
    } catch (e) {
      set({ pending: false, error: e instanceof Error ? e.message : String(e), hash: null });
      return false;
    }
  }
  return { ...s, run };
}

/** nep-145 min for a token account row; excess is refunded */
const FT_REG = "1250000000000000000000";

/** register `account` on an ft so payouts in it do not park as owed */
export const registerFt = (token: string, account: string): Tx => ({
  receiverId: token,
  actions: [actionCreators.functionCall("storage_deposit", { account_id: account, registration_only: true }, BigInt(10_000_000_000_000), BigInt(FT_REG))],
});
