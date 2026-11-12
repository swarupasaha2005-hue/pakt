export type Alert = {
  id: string;
  /** accounts or pakt ids */
  actors: string[];
  unit: "traders" | "pakts";
  side: "buy" | "sell";
  /** usd */
  size: number;
  symbol: string;
  /** percent */
  change1h: number;
  /** someone you follow is in the group */
  following: boolean;
  secondsAgo: number;
};

export const alerts: Alert[] = [
  { id: "a1", actors: ["degens", "wagmi", "nightowls", "stackers"], unit: "pakts", side: "buy", size: 5_100, symbol: "NEAR", change1h: -2.1, following: true, secondsAgo: 7_200 },
  { id: "a2", actors: ["bob.near", "erin.near", "ivan.near"], unit: "traders", side: "sell", size: 1_200, symbol: "wBTC", change1h: -0.4, following: false, secondsAgo: 18_000 },
  { id: "a3", actors: ["alice.near", "carol.near"], unit: "traders", side: "buy", size: 3_840, symbol: "AURORA", change1h: 4.62, following: true, secondsAgo: 21_600 },
  { id: "a4", actors: ["wagmi", "stackers"], unit: "pakts", side: "buy", size: 2_450, symbol: "ETH", change1h: 0.31, following: false, secondsAgo: 36_000 },
  { id: "a5", actors: ["grace.near", "dave.near", "frank.near"], unit: "traders", side: "sell", size: 960, symbol: "REF", change1h: -3.08, following: true, secondsAgo: 90_000 },
];
