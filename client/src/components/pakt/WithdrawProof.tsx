"use client";

import { actionCreators } from "@near-js/transactions";
import { useState } from "react";
import { ExternalIcon } from "@/components/ui/icons";
import { useWallet } from "@/lib/near/wallet";
import { txProblem } from "@/lib/pakt/tx";
import { nearblocks } from "@/lib/pakt/units";

type S = { kind: "idle" } | { kind: "pending" } | { kind: "blocked"; hash: string | null } | { kind: "other"; msg: string };
const NO_METHOD = /MethodNotFound|MethodResolveError|CodeDoesNotExist|Method .* not found/i;
const HASH = /\b[1-9A-HJ-NP-Za-km-z]{43,44}\b/;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** the account's failed withdraw to this vault since `since`, from the explorer; null if none landed in `tries` polls */
async function failedWithdraw(account: string, vault: string, since: number, tries = 4, stop = { done: false }): Promise<string | null> {
  // the explorer indexes a few seconds behind the chain
  for (let i = 0; i < tries && !stop.done; i++) {
    const r = await fetch(`https://api-testnet.nearblocks.io/v3/accounts/${account}/txns?per_page=5`).catch(() => null);
    type T = { transaction_hash: string; receiver_account_id: string; block_timestamp: string; outcomes: { status: boolean }; actions: { method?: string }[] };
    const txs: T[] = (r?.ok && (await r.json()).data) || [];
    const hit = txs.find((t) => t.receiver_account_id === vault && t.actions?.[0]?.method === "withdraw" && !t.outcomes.status && Number(t.block_timestamp) / 1e6 >= since);
    if (hit) return hit.transaction_hash;
    await sleep(2500);
  }
  return null;
}

/** pakter-only demo: send a real withdraw call and show the vault has no such method */
export function WithdrawProof({ vault }: { vault: string }) {
  const { accountId, signAndSend } = useWallet();
  const [s, set] = useState<S>({ kind: "idle" });

  async function attempt() {
    set({ kind: "pending" });
    const started = Date.now() - 15_000; // small clock skew margin, so an older attempt is not picked up
    const tx = { receiverId: vault, actions: [actionCreators.functionCall("withdraw", {}, BigInt(10_000_000_000_000), BigInt(0))] };
    // meteor holds its promise until the user closes the popup, so watch the chain meanwhile
    const stop = { done: false };
    if (accountId)
      failedWithdraw(accountId, vault, started, 60, stop).then((hash) => {
        if (!hash || stop.done) return;
        stop.done = true;
        set({ kind: "blocked", hash });
      });
    try {
      const { outs } = await signAndSend([tx]);
      if (stop.done) return;
      stop.done = true;
      const problem = txProblem(outs) ?? "";
      const hash = outs.at(-1)?.transaction?.hash ?? null;
      set(NO_METHOD.test(problem) ? { kind: "blocked", hash } : { kind: "other", msg: problem || "Unexpected result" });
    } catch (e) {
      // some wallets throw on a failed tx instead of returning the outcome
      if (stop.done) return;
      stop.done = true;
      const msg = e instanceof Error ? e.message : String(e);
      if (NO_METHOD.test(msg)) return set({ kind: "blocked", hash: msg.match(HASH)?.[0] ?? null });
      // meteor shows the chain error in its popup, then reports only "window closed": check the chain for the failed tx
      const hash = accountId ? await failedWithdraw(accountId, vault, started) : null;
      set(hash ? { kind: "blocked", hash } : { kind: "other", msg });
    }
  }

  if (s.kind === "blocked")
    return (
      <div role="status" className="mt-3 animate-fade-in rounded-lg border border-down/40 bg-down/10 px-3 py-2.5 text-xs">
        <p className="font-medium text-down">🔒 Blocked by contract</p>
        <p className="mt-0.5 text-text-2">This vault has no withdraw method. A pakter can only swap between whitelisted tokens, so the money stays in the pakt.</p>
        <a
          href={s.hash ? nearblocks(s.hash) : `https://testnet.nearblocks.io/address/${vault}`}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-text hover:underline"
        >
          {s.hash ? "See the failed tx" : "See the vault contract"} <ExternalIcon className="size-3" />
        </a>
      </div>
    );

  return (
    <p className="mt-3 text-center text-xs text-text-3">
      <button type="button" disabled={s.kind === "pending"} onClick={attempt} className="underline-offset-2 hover:text-text-2 hover:underline disabled:opacity-60">
        {s.kind === "pending" ? "Sending withdraw…" : "Try to withdraw the vault"}
      </button>
      {s.kind === "other" && <span className="mt-1 block break-words text-text-2">{s.msg}</span>}
    </p>
  );
}
