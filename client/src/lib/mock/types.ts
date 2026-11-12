export type Range = "24H" | "7D" | "30D" | "ALL";

export type Token = {
  symbol: string;
  name: string;
  price: number;
  /** percent, e.g. -0.52 */
  change24h: number;
  volume24h: number;
  mcap: number;
  holders: number;
  /** on the pakt whitelist, tradable by traders */
  allowed: boolean;
  color: string;
  glyph: string;
  /** /public path */
  logo: string;
};

export type Trader = {
  account: string;
  name: string;
  /** percent of new profit, 10–30 */
  askingFee: number;
  /** usd */
  pnl: Record<Range, number>;
  openToHire: boolean;
};

export type Member = { account: string; shares: number };

export type Pakt = {
  id: string;
  name: string;
  members: Member[];
  /** usd */
  vaultValue: number;
  /** null = hiring */
  trader: string | null;
  budget: number;
  budgetUsed: number;
  maxPerTrade: number;
  /** percent */
  fee: number;
  /** percent drawdown that pauses trading */
  stopLoss: number;
  pnl7d: number;
  /** percent */
  pnl7dPct: number;
  /** false = invite only */
  open: boolean;
};

export type FeedKind =
  | "buy"
  | "sell"
  | "vote"
  | "hired"
  | "fired"
  | "settled"
  | "joined"
  | "left";

export type FeedEvent = {
  id: string;
  kind: FeedKind;
  /** account or pakt id */
  actor: string;
  paktId: string;
  detail: string;
  secondsAgo: number;
};

export type Me = {
  account: string;
  name: string;
  cash: number;
  /** cash + pakt shares, usd */
  total: number;
  /** percent */
  change24h: number;
  paktIds: string[];
};
