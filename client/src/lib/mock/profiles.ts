import { me } from "./me";
import { traders } from "./traders";
import type { Range } from "./types";

export type TraderRecord = {
  /** usd, lifetime pnl traded for pakts */
  pnl: number;
  /** percent */
  winRate: number;
  pakts: number;
  /** percent */
  maxDrawdown: number;
};

export type Profile = {
  account: string;
  name: string;
  bio: string;
  /** handles without @, "" = not linked */
  x: string;
  telegram: string;
  /** image url, "" = default avatar / plain cover */
  avatar: string;
  cover: string;
  openToHire: boolean;
  /** percent of new profit, 10–30 */
  askingFee: number;
  joined: string;
  /** null = never held */
  avgHold: string | null;
  trades: number;
  following: number;
  followers: number;
  /** usd, cash + pakt shares */
  value: number;
  pnl: Record<Range, number>;
  /** null = never traded for a pakt */
  record: TraderRecord | null;
};

type Extra = Omit<Profile, "account" | "name" | "openToHire" | "askingFee" | "pnl">;

const blank = { avatar: "", cover: "" };

const extra: Record<string, Extra> = {
  "alice.near": { ...blank, bio: "Momentum on NEAR majors. Cut losers fast.", x: "alice_trades", telegram: "alice_near", joined: "Aug 2026", avgHold: "6h", trades: 482, following: 41, followers: 1_204, value: 96_200, record: { pnl: 31_920, winRate: 64, pakts: 3, maxDrawdown: 12 } },
  "bob.near": { ...blank, bio: "Slow and steady. BTC/ETH rotations.", x: "bobstacks", telegram: "", joined: "Sep 2026", avgHold: "2d", trades: 156, following: 12, followers: 880, value: 61_400, record: { pnl: 22_140, winRate: 58, pakts: 2, maxDrawdown: 9 } },
  "carol.near": { ...blank, bio: "Night shift scalper.", x: "", telegram: "carolscalps", joined: "Sep 2026", avgHold: "40m", trades: 1_310, following: 77, followers: 650, value: 52_100, record: { pnl: 18_770, winRate: 55, pakts: 2, maxDrawdown: 18 } },
  "dave.near": { ...blank, bio: "", x: "", telegram: "", joined: "Oct 2026", avgHold: "1d", trades: 64, following: 30, followers: 95, value: 18_900, record: { pnl: -2_210, winRate: 41, pakts: 1, maxDrawdown: 22 } },
  "erin.near": { ...blank, bio: "Macro first, memes never.", x: "erin_macro", telegram: "erinmacro", joined: "Jul 2026", avgHold: "4d", trades: 98, following: 8, followers: 2_310, value: 70_300, record: { pnl: 26_400, winRate: 71, pakts: 2, maxDrawdown: 7 } },
  "frank.near": { ...blank, bio: "Here for the pakts.", x: "", telegram: "", joined: "Oct 2026", avgHold: "3h", trades: 37, following: 54, followers: 22, value: 9_800, record: null },
  "grace.near": { ...blank, bio: "Stables in, NEAR out. Patience pays.", x: "gracecooks", telegram: "", joined: "Aug 2026", avgHold: "5d", trades: 71, following: 19, followers: 310, value: 15_400, record: { pnl: 5_230, winRate: 62, pakts: 1, maxDrawdown: 5 } },
  "heidi.near": { ...blank, bio: "", x: "", telegram: "heidi_h", joined: "Nov 2026", avgHold: null, trades: 0, following: 3, followers: 4, value: 12_700, record: null },
  "ivan.near": { ...blank, bio: "Learning in public.", x: "ivan_learns", telegram: "", joined: "Nov 2026", avgHold: "8h", trades: 23, following: 60, followers: 15, value: 4_200, record: null },
};

export const profiles: Profile[] = [
  {
    ...blank,
    account: me.account,
    name: me.name,
    bio: "",
    x: "",
    telegram: "",
    openToHire: false,
    askingFee: 20,
    joined: "Nov 2026",
    avgHold: "1d",
    trades: 12,
    following: 6,
    followers: 2,
    value: me.total,
    pnl: { "24H": 63, "7D": 210, "30D": 486, ALL: 486 },
    record: null,
  },
  ...traders.map((t) => ({ ...t, ...extra[t.account] })),
];

/** smooth deterministic curve from value - pnl to value; endpoints exact */
export function valueSeries(p: Profile, range: Range, n = 60): number[] {
  const start = Math.max(p.value - p.pnl[range], 0);
  const seed = p.account.length + range.length;
  const amp = Math.max(Math.abs(p.value - start), p.value * 0.01) * 0.25;
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const wiggle = Math.sin(Math.PI * t) * (Math.sin(i * 0.45 + seed) + 0.5 * Math.sin(i * 1.3 + seed * 1.7)) * amp;
    return Math.max(start + (p.value - start) * t + wiggle, 0);
  });
}
