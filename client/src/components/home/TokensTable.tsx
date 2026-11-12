"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { loadPakts, loadTokens, useLoad, usdNum, type PaktInfo } from "@/lib/home/data";
import { usdE6 } from "@/lib/near/contracts";
import { TokenRow } from "./TokenRow";

/** usd each pakt holds of a token (balances + at_dex), largest first */
export function heldIn(token: string, list: PaktInfo[]) {
  return list
    .map((p) => {
      const i = p.state.balances.findIndex(([t]) => t === token);
      if (i < 0) return { pakt: p, value: 0 };
      const raw = BigInt(p.state.balances[i][1]) + BigInt(p.state.at_dex[i]?.[1] ?? "0");
      const v = usdE6(p.prices, token, raw.toString());
      return { pakt: p, value: v === null ? 0 : usdNum(v) };
    })
    .filter((h) => h.value > 0)
    .toSorted((a, b) => b.value - a.value);
}

export function TokensTable() {
  const tokens = useLoad(loadTokens, []);
  const pakts = useLoad(loadPakts, []);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[640px] text-left">
        <thead className="sticky top-0 z-20 bg-panel text-xs text-text-3 [&_th]:font-medium">
          <tr className="h-[38px] border-b">
            <th className="w-[300px] border-r px-3">Token name</th>
            <th className="px-3">Price</th>
            <th className="px-3">Held by pakts</th>
            <th className="px-3">Top pakt</th>
          </tr>
        </thead>
        <tbody>
          {tokens.data?.map((t) => <TokenRow key={t.id} token={t} held={pakts.data && heldIn(t.id, pakts.data)} />)}
        </tbody>
      </table>
      {!tokens.data && !tokens.error && (
        <div className="space-y-2 p-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
        </div>
      )}
      {tokens.error && <p className="py-10 text-center text-sm text-text-2">Could not load prices</p>}
    </div>
  );
}
