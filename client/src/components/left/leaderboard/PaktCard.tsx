import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Pct } from "@/components/ui/Pct";

/** grid card; top 3 get a rank node on the avatar. change is a fraction */
export function PaktCard({ name, change, rank }: { name: string; change: number; rank: number }) {
  return (
    <Link href={`/pakt/${name}`} className="flex items-center gap-2 rounded-xl bg-panel-2 p-2 transition hover:brightness-125">
      <Avatar
        name={name}
        badge={rank <= 3 && <span className="flex size-full items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">{rank}</span>}
      />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm leading-5">{name}</span>
        <Pct value={change * 100} className="text-xs leading-5" />
      </span>
    </Link>
  );
}
