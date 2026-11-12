import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { UsersIcon } from "@/components/ui/icons";
import { Pct } from "@/components/ui/Pct";
import { usd } from "@/lib/format";
import { pakts } from "@/lib/mock/pakts";

const COLS = ["Pakt name", "Trader", "Vault value", "7D PnL", "Members", "Fee"];

export function PaktsTable() {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[760px] text-left">
        <thead className="sticky top-0 z-20 bg-panel text-xs text-text-2">
          <tr className="h-[38px] border-b">
            {COLS.map((c) => (
              <th key={c} className="px-3">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pakts.toSorted((a, b) => b.vaultValue - a.vaultValue).map((p) => (
            <tr key={p.id} className="relative h-14 text-base hover:bg-panel-2/60">
              <td className="px-3">
                <span className="flex items-center gap-3">
                  <Avatar name={p.name} />
                  <span className="flex flex-col leading-5">
                    <Link href={`/pakt/${p.id}`} className="after:absolute after:inset-0">{p.name}</Link>
                    <span className="text-xs text-text-2">{p.paused ? "Paused" : p.open ? "Open" : "Invite only"}</span>
                  </span>
                </span>
              </td>
              <td className="px-3">
                {p.trader ? (
                  <span className="flex items-center gap-2">
                    <Avatar name={p.trader} size={24} />
                    {p.trader}
                  </span>
                ) : (
                  <span className="text-text-3">Hiring</span>
                )}
              </td>
              <td className="px-3">{usd(p.vaultValue)}</td>
              <td className="px-3">
                <span className="flex flex-col leading-5">
                  <span className={p.pnl7d < 0 ? "text-down" : "text-up"}>
                    {p.pnl7d < 0 ? "-" : "+"}
                    {usd(Math.abs(p.pnl7d))}
                  </span>
                  <Pct value={p.pnl7dPct} className="text-xs" />
                </span>
              </td>
              <td className="px-3">
                <span className="flex items-center gap-2">
                  <UsersIcon className="size-4 text-text-2" />
                  {p.members.length}
                </span>
              </td>
              <td className="px-3">{p.trader ? <Badge>{p.fee}% fee</Badge> : <span className="text-text-3">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
