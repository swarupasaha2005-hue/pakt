import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { signed, usd } from "@/lib/format";
import type { Pakt } from "@/lib/mock/types";

export function MembersTable({ pakt }: { pakt: Pakt }) {
  const total = pakt.members.reduce((s, m) => s + m.shares, 0);
  return (
    <table className="w-full text-xs">
      <thead className="text-left text-xs text-text-2">
        <tr>
          <th className="py-2">Member</th>
          <th className="text-right">Share</th>
          <th className="text-right">Value</th>
          <th className="text-right">PnL 7D</th>
        </tr>
      </thead>
      <tbody>
        {pakt.members.map((m) => {
          const share = m.shares / total;
          const pnl = share * pakt.pnl7d;
          return (
            <tr key={m.account} className="border-t">
              <td className="flex items-center gap-2 py-2.5">
                <Avatar name={m.account} size={28} />
                {m.account}
                {m.account === pakt.trader && <Badge>trader</Badge>}
              </td>
              <td className="text-right">{(share * 100).toFixed(1)}%</td>
              <td className="text-right">{usd(share * pakt.vaultValue)}</td>
              <td className={`text-right ${pnl < 0 ? "text-down" : "text-up"}`}>{signed(pnl)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
