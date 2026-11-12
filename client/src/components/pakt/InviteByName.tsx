"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { NETWORK } from "@/lib/config";
import { useWallet } from "@/lib/near/wallet";
import { useTx } from "@/lib/pakt/tx";
import { isAccountId } from "@/lib/profile/format";
import { accountExists, inviteTx } from "@/lib/social";
import { TxStatus } from "./TxStatus";

const SUFFIX = NETWORK === "mainnet" ? ".near" : ".testnet";

/** type NEAR account names; they get a NEAR Social mention with the pakt link */
export function InviteByName({ pakt }: { pakt: string }) {
  const { accountId } = useWallet();
  const [input, setInput] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const tx = useTx(() => setInput(""));

  async function send() {
    if (!accountId) return;
    // bare names get the network suffix: alice -> alice.testnet
    const names = [...new Set(input.split(/[\s,]+/).filter(Boolean).map((n) => (n.includes(".") ? n : n + SUFFIX).toLowerCase()))];
    const bad = names.find((n) => !isAccountId(n) || n === accountId);
    if (!names.length || bad) return setProblem(bad ? `${bad} is not a valid account` : "Type an account name");
    if (names.length > 10) return setProblem("Up to 10 at a time");
    setChecking(true);
    const exists = await Promise.all(names.map(accountExists)).catch(() => names.map(() => true));
    setChecking(false);
    const missing = names.filter((_, i) => !exists[i]);
    if (missing.length) return setProblem(`${missing.join(", ")} does not exist on NEAR`);
    setProblem(null);
    tx.run([inviteTx(accountId, names, pakt, `${location.origin}/pakt/${pakt}`)]);
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2"
      >
        <Input aria-label="Account names to invite" placeholder={`alice${SUFFIX}, bob${SUFFIX}`} value={input} onChange={(e) => setInput(e.target.value)} />
        <Button type="submit" disabled={!accountId || !input.trim() || checking || tx.pending} className="shrink-0">
          {checking ? "Checking…" : tx.pending ? "Sending…" : "Invite"}
        </Button>
      </form>
      <p className="mt-1.5 text-xs text-text-3">{accountId ? "They get a NEAR Social notification with the link." : "Connect a wallet to invite by name."}</p>
      {problem && <p role="alert" className="mt-1 text-xs text-down">{problem}</p>}
      <TxStatus {...tx} done="Invite sent" />
    </div>
  );
}
