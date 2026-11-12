import type { PaktInfo, TokenPrice } from "@/lib/home/data";

export type Hits = { tokens: TokenPrice[]; pakts: PaktInfo[]; traders: string[] };

const has = (s: string, q: string) => s.toLowerCase().includes(q);

/** case-insensitive substring match; empty query = everything, capped per section */
export function match(q: string, tokens: TokenPrice[], pakts: PaktInfo[], cap = 5): Hits {
  const s = q.trim().toLowerCase();
  const traders = [...new Set(pakts.flatMap((p) => (p.trader ? [p.trader.account] : [])))];
  return {
    tokens: tokens.filter((t) => has(t.symbol, s) || has(t.id, s)).slice(0, cap),
    pakts: pakts.filter((p) => has(p.name, s) || has(p.vault, s)).slice(0, cap),
    traders: traders.filter((a) => has(a, s)).slice(0, cap),
  };
}
