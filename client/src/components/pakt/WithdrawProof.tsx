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

/** pakter-only demo: send a real withdraw call and show the vault has no such method */
export function WithdrawProof({ vault }: { vault: string }) {
  const { signAndSend } = useWallet();
  const [s, set] = useState<S>({ kind: "idle" });

  async function attempt() {
    set({ kind: "pending" });
    const tx = { receiverId: vault, actions: [actionCreators.functionCall("withdraw", {}, BigInt(10_000_000_000_000), BigInt(0))] };
    try {
      const { outs } = await signAndSend([tx]);
      const problem = txProblem(outs) ?? "";
      const hash = outs.at(-1)?.transaction?.hash ?? null;
      set(NO_METHOD.test(problem) ? { kind: "blocked", hash } : { kind: "other", msg: problem || "Unexpected result" });
    } catch (e) {
      // some wallets throw on a failed tx instead of returning the outcome
      const msg = e instanceof Error ? e.message : String(e);
      set(NO_METHOD.test(msg) ? { kind: "blocked", hash: msg.match(HASH)?.[0] ?? null } : { kind: "other", msg });
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
