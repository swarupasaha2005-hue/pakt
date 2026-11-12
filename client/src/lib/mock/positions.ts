/** nova.near's positions; paktId = held for a pakt nova trades for */
export type Position = { symbol: string; paktId: string | null; amount: number; avgEntry: number; open: boolean };

export const positions: Position[] = [
  { symbol: "NEAR", paktId: null, amount: 120, avgEntry: 5.1, open: true },
  { symbol: "AURORA", paktId: "nightshift", amount: 2_200, avgEntry: 0.085, open: true },
  { symbol: "wBTC", paktId: "nightshift", amount: 0.004, avgEntry: 71_900, open: true },
  { symbol: "ETH", paktId: null, amount: 0.05, avgEntry: 2_100, open: false },
];
