import { Avatar } from "@/components/ui/Avatar";
import { compact } from "@/lib/format";
import type { Pakt } from "@/lib/mock/types";

export function PaktHeader({ pakt, trades }: { pakt: Pakt; trades: number }) {
  const stats = [
    [pakt.members.length, "Members"],
    [compact(pakt.vaultValue), "Vault"],
  ] as const;
  return (
    <header className="border-b pb-4">
      <div className="flex flex-wrap items-center gap-3 px-2 pt-3">
        <span className="rounded-full ring-4 ring-bg">
          <Avatar name={pakt.name} size={60} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{pakt.name}</h1>
          <p className="truncate text-xs text-text-2">{pakt.id}.sputnik-dao.near</p>
        </div>
        {stats.map(([value, label]) => (
          <div key={label} className="w-20 text-center">
            <div className="text-base">{value}</div>
            <div className="text-xs text-text-2">{label}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 flex gap-4 px-2 text-xs text-text-2">
        <span>◷ Since Nov 2026</span>
        <span>⇄ {trades} trades</span>
        <span>⛨ Stop-loss {pakt.stopLoss}%</span>
        <span>{pakt.open ? "Open to join" : "Invite only"}</span>
      </p>
    </header>
  );
}
