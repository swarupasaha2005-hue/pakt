import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Pct } from "@/components/ui/Pct";
import { usd } from "@/lib/format";
import { tokens } from "@/lib/mock/tokens";

/** starred tokens as chips; empty = hint card */
export function PinStrip({ starred }: { starred: string[] }) {
  if (!starred.length) {
    return (
      <div className="flex h-[62px] w-fit shrink-0 items-center rounded-2xl border px-3 text-[15px] text-text-3">
        Star assets to pin them here
      </div>
    );
  }
  return (
    <div className="flex h-[62px] shrink-0 gap-2 overflow-x-auto">
      {tokens
        .filter((t) => starred.includes(t.symbol))
        .map((t) => (
          <Link key={t.symbol} href={`/token/${t.symbol}`} className="flex shrink-0 items-center gap-2.5 rounded-2xl border px-3 hover:bg-panel-2">
            <Avatar name={t.symbol} glyph={t.glyph} color={t.color} size={32} />
            <span className="flex flex-col">
              <span className="text-[15px] leading-5">{t.symbol}</span>
              <span className="flex gap-1.5 text-[13px] leading-5 text-text-2">
                {usd(t.price)} <Pct value={t.change24h} />
              </span>
            </span>
          </Link>
        ))}
    </div>
  );
}
