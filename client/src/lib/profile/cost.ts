import type { PaktEvent } from "../api";

/** usd put in per vault (average cost): deposits add their value, a leave removes its slice of shares' cost */
export function costBasis(events: PaktEvent[], account: string): Map<string, number> {
  const pos = new Map<string, { cost: number; shares: bigint }>();
  for (const e of events.toSorted((a, b) => a.id - b.id)) {
    if ((e.kind !== "deposit" && e.kind !== "leave") || e.data.account !== account) continue;
    const p = pos.get(e.vault) ?? { cost: 0, shares: BigInt(0) };
    if (e.kind === "deposit") {
      p.cost += Number(e.data.value) / 1e6;
      p.shares += BigInt(e.data.shares);
    } else if (p.shares > BigInt(0)) {
      const burn = BigInt(e.data.shares) > p.shares ? p.shares : BigInt(e.data.shares);
      p.cost -= (p.cost * Number(burn)) / Number(p.shares);
      p.shares -= burn;
    }
    pos.set(e.vault, p);
  }
  return new Map([...pos].map(([v, p]) => [v, p.cost]));
}
