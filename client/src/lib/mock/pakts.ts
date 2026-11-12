import type { Pakt } from "./types";

export const pakts: Pakt[] = [
  {
    id: "degens", name: "degens", vaultValue: 6_200, trader: "alice.near",
    members: [{ account: "nova.near", shares: 1_240 }, { account: "dave.near", shares: 1_800 }, { account: "grace.near", shares: 1_160 }, { account: "frank.near", shares: 1_000 }, { account: "heidi.near", shares: 1_000 }],
    budget: 500, budgetUsed: 60, maxPerTrade: 50, fee: 20, stopLoss: 25, pnl7d: 1_240, pnl7dPct: 20.1, open: true,
  },
  {
    id: "wagmi", name: "wagmi", vaultValue: 14_850, trader: "bob.near",
    members: [{ account: "nova.near", shares: 996 }, { account: "erin.near", shares: 6_000 }, { account: "ivan.near", shares: 4_200 }, { account: "grace.near", shares: 3_654 }],
    budget: 3_000, budgetUsed: 1_120, maxPerTrade: 400, fee: 15, stopLoss: 20, pnl7d: 2_030, pnl7dPct: 15.8, open: true,
  },
  {
    id: "moonboys", name: "moonboys", vaultValue: 1_100, trader: null,
    members: [{ account: "frank.near", shares: 500 }, { account: "ivan.near", shares: 350 }, { account: "heidi.near", shares: 250 }],
    budget: 0, budgetUsed: 0, maxPerTrade: 0, fee: 0, stopLoss: 30, pnl7d: -310, pnl7dPct: -22, open: true,
  },
  {
    id: "nightowls", name: "nightowls", vaultValue: 9_420, trader: "carol.near",
    members: [{ account: "dave.near", shares: 3_100 }, { account: "heidi.near", shares: 2_900 }, { account: "frank.near", shares: 1_920 }, { account: "grace.near", shares: 1_500 }],
    budget: 2_000, budgetUsed: 1_850, maxPerTrade: 250, fee: 25, stopLoss: 15, pnl7d: 980, pnl7dPct: 11.6, open: false,
  },
  {
    id: "stackers", name: "stackers", vaultValue: 22_300, trader: "erin.near",
    members: [{ account: "alice.near", shares: 9_000 }, { account: "bob.near", shares: 7_300 }, { account: "dave.near", shares: 6_000 }],
    budget: 5_000, budgetUsed: 2_400, maxPerTrade: 1_000, fee: 30, stopLoss: 20, pnl7d: 1_410, pnl7dPct: 6.7, open: false,
  },
  {
    id: "slowcookers", name: "slowcookers", vaultValue: 3_050, trader: "grace.near",
    members: [{ account: "ivan.near", shares: 1_200 }, { account: "carol.near", shares: 1_050 }, { account: "frank.near", shares: 800 }],
    budget: 800, budgetUsed: 120, maxPerTrade: 100, fee: 15, stopLoss: 10, pnl7d: -45, pnl7dPct: -1.5, open: true,
  },
];
