"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { CheckIcon } from "@/components/ui/icons";
import { Pct } from "@/components/ui/Pct";
import { Segmented } from "@/components/ui/Segmented";
import { compact, usd } from "@/lib/format";
import { tokens } from "@/lib/mock/tokens";
import type { Token } from "@/lib/mock/types";
import { Row } from "./Row";

const CHIPS = ["All", "Trending", "Most held", "Stables"] as const;
type Chip = (typeof CHIPS)[number];

const STABLES = ["USDC", "USDT"];

function view(chip: Chip): Token[] {
  if (chip === "Trending") return tokens.toSorted((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h));
  if (chip === "Most held") return tokens.toSorted((a, b) => b.holders - a.holders);
  if (chip === "Stables") return tokens.filter((t) => STABLES.includes(t.symbol));
  return tokens;
}

export function TokensTab() {
  const [chip, setChip] = useState<Chip>("All");
  const pathname = usePathname();

  return (
    <>
      <Segmented options={CHIPS} value={chip} onChange={setChip} className="px-3 pt-1.5 pb-2" />
      <ul className="flex-1 space-y-1 overflow-y-auto px-2">
        {view(chip).map((t) => (
          <li key={t.symbol}>
            <Row
              href={`/token/${t.symbol}`}
              selected={pathname === `/token/${t.symbol}`}
              avatar={
                <Avatar
                  name={t.symbol}
                  glyph={t.glyph}
                  color={t.color}
                  badge={t.allowed && <CheckIcon className="size-3.5 rounded-full bg-accent p-0.5 text-white" strokeWidth={3} />}
                />
              }
              title={<>{t.symbol}{t.allowed && <Badge>allowed</Badge>}</>}
              subtitle={`${compact(t.volume24h)} Vol`}
              value={usd(t.price)}
              change={<Pct value={t.change24h} />}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
