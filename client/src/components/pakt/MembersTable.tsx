import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { usd } from "@/lib/format";
import { sharesValue, type Holder, type VaultState } from "@/lib/near/contracts";
import { e6 } from "@/lib/pakt/units";

type Props = { holders: [string, Holder][]; state: VaultState; value: bigint | null };

/** every share holder; member:false rows hold fee shares only (trader, platform) */
export function MembersTable({ holders, state, value }: Props) {
  if (!holders.length) return <p className="py-8 text-center text-sm text-text-2">No members yet</p>;
  const total = Number(state.total_shares) || 1;
  const rows = holders.toSorted((a, b) => Number(b[1].shares) - Number(a[1].shares));
  return (
    <table className="w-full text-xs">
      <thead className="text-left text-xs text-text-2">
        <tr>
          <th className="py-2">Member</th>
          <th className="text-right">Share</th>
          <th className="text-right">Value</th>
          <th className="text-right">Joined</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([account, h]) => (
          <tr key={account} className="border-t">
            <td className="flex items-center gap-2 py-2.5">
              <Avatar name={account} size={28} />
              {account}
              {account === state.trader?.account && <Badge>trader</Badge>}
              {!h.member && account !== state.trader?.account && <Badge tone="neutral">fees</Badge>}
            </td>
            <td className="text-right">{((Number(h.shares) / total) * 100).toFixed(1)}%</td>
            <td className="text-right">{value === null ? "—" : usd(e6(sharesValue(h.shares, state, value)))}</td>
            <td className="text-right text-text-2">{new Date(h.joined_ms).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
