export type Position = {
  id: string;
  /** account (solo vault) or pakt id */
  owner: string;
  symbol: string;
  amount: number;
  /** usd */
  value: number;
  pnl: number;
  /** percent */
  pnlPct: number;
  open: boolean;
};

export const positions: Position[] = [
  { id: "p1", owner: "nova.near", symbol: "NEAR", amount: 120, value: 650, pnl: 38, pnlPct: 6.2, open: true },
  { id: "p2", owner: "nova.near", symbol: "AURORA", amount: 2_400, value: 219, pnl: 24, pnlPct: 12.3, open: true },
  { id: "p3", owner: "nova.near", symbol: "ETH", amount: 0.1, value: 0, pnl: -18, pnlPct: -3.1, open: false },
  { id: "p4", owner: "degens", symbol: "NEAR", amount: 350, value: 1_897, pnl: 112, pnlPct: 6.3, open: true },
  { id: "p5", owner: "degens", symbol: "AURORA", amount: 1_500, value: 137, pnl: -9, pnlPct: -6.2, open: false },
  { id: "p6", owner: "wagmi", symbol: "wBTC", amount: 0.012, value: 881, pnl: -6, pnlPct: -0.7, open: true },
  { id: "p7", owner: "wagmi", symbol: "ETH", amount: 0.4, value: 818, pnl: 41, pnlPct: 5.3, open: false },
  { id: "p8", owner: "nightowls", symbol: "AURORA", amount: 1_500, value: 137, pnl: 1, pnlPct: 0.8, open: true },
  { id: "p9", owner: "stackers", symbol: "ETH", amount: 0.4, value: 818, pnl: 2, pnlPct: 0.2, open: true },
  { id: "p10", owner: "slowcookers", symbol: "NEAR", amount: 9.2, value: 50, pnl: 0, pnlPct: 0, open: true },
  { id: "p11", owner: "alice.near", symbol: "NEAR", amount: 2_000, value: 10_840, pnl: 640, pnlPct: 6.3, open: true },
  { id: "p12", owner: "alice.near", symbol: "BLACKDRAGON", amount: 9_000_000_000, value: 154, pnl: 480, pnlPct: 310, open: false },
  { id: "p13", owner: "bob.near", symbol: "wBTC", amount: 0.3, value: 22_033, pnl: -120, pnlPct: -0.5, open: true },
  { id: "p14", owner: "erin.near", symbol: "ETH", amount: 4, value: 8_180, pnl: 210, pnlPct: 2.6, open: true },
];
