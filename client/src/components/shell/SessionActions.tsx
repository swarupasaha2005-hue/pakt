"use client";

import { useMockSession } from "@/components/session/MockSessionProvider";
import { Button } from "@/components/ui/Button";
import { AccountPill } from "./AccountPill";
import { CashPill } from "./CashPill";

export function SessionActions() {
  const { connected, requestConnect } = useMockSession();

  return (
    <div className="flex justify-end gap-2.5">
      {connected ? (
        <>
          <CashPill />
          <AccountPill />
        </>
      ) : (
        <Button variant="primary" onClick={requestConnect}>Connect wallet</Button>
      )}
    </div>
  );
}
