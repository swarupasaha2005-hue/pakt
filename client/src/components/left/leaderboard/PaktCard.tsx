import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { compact, signed } from "@/lib/format";
import type { Pakt } from "@/lib/mock/types";

/** grid card; top 3 get a rank node on the avatar */
export function PaktCard({ pakt, rank }: { pakt: Pakt; rank: number }) {
  return (
    <Link href={`/pakt/${pakt.id}`} className="flex items-center gap-2 rounded-xl bg-panel-2 p-2 transition hover:brightness-125">
      <Avatar
        name={pakt.name}
        badge={rank <= 3 && <span className="flex size-full items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">{rank}</span>}
      />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-base leading-5">{pakt.name}</span>
        <span className={`text-sm leading-5 ${pakt.pnl7d < 0 ? "text-down" : "text-up"}`}>{signed(pakt.pnl7d, compact)}</span>
      </span>
    </Link>
  );
}
