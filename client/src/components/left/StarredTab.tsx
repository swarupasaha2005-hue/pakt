"use client";

import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Pct } from "@/components/ui/Pct";
import { usd } from "@/lib/format";
import { pakts } from "@/lib/mock/pakts";
import { stars } from "@/lib/mock/stars";
import { tokens } from "@/lib/mock/tokens";
import { Row } from "./Row";

const heading = "px-2 pt-2 pb-1 text-xs font-semibold text-text-3";

export function StarredTab() {
  const pathname = usePathname();

  return (
    <ul className="flex-1 space-y-1 overflow-y-auto px-2">
      <li className={heading}>Tokens</li>
      {tokens.filter((t) => stars.tokens.includes(t.symbol)).map((t) => (
        <li key={t.symbol}>
          <Row
            href={`/token/${t.symbol}`}
            selected={pathname === `/token/${t.symbol}`}
            avatar={<Avatar name={t.symbol} src={t.logo} />}
            title={t.symbol}
            subtitle={t.name}
            value={usd(t.price)}
            change={<Pct value={t.change24h} />}
          />
        </li>
      ))}
      <li className={heading}>Pakts</li>
      {pakts.filter((p) => stars.pakts.includes(p.id)).map((p) => (
        <li key={p.id}>
          <Row
            href={`/pakt/${p.id}`}
            selected={pathname === `/pakt/${p.id}`}
            avatar={<Avatar name={p.name} />}
            title={p.name}
            subtitle={`${p.members.length} members`}
            value={usd(p.vaultValue)}
            change={<Pct value={p.pnl7dPct} />}
          />
        </li>
      ))}
    </ul>
  );
}
