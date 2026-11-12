import type { FeedEvent } from "./types";

export const feed: FeedEvent[] = [
  { id: "e1", kind: "buy", actor: "alice.near", paktId: "degens", detail: "200 NEAR at $5.41", secondsAgo: 25 },
  { id: "e2", kind: "vote", actor: "frank.near", paktId: "moonboys", detail: "Hire carol.near at 25% · 1/3 yes", secondsAgo: 30 },
  { id: "e3", kind: "settled", actor: "degens", paktId: "degens", detail: "+$120 · trader $24 · platform $1.20", secondsAgo: 60 },
  { id: "e4", kind: "joined", actor: "nova.near", paktId: "wagmi", detail: "added $100", secondsAgo: 120 },
  { id: "e5", kind: "sell", actor: "bob.near", paktId: "wagmi", detail: "0.012 wBTC at $73,450", secondsAgo: 340 },
  { id: "e6", kind: "buy", actor: "carol.near", paktId: "nightowls", detail: "1,500 AURORA at $0.0905", secondsAgo: 610 },
  { id: "e7", kind: "hired", actor: "grace.near", paktId: "slowcookers", detail: "budget $800 · max $100 per trade · 15%", secondsAgo: 1_800 },
  { id: "e8", kind: "fired", actor: "dave.near", paktId: "moonboys", detail: "fired after -22% this week", secondsAgo: 3_600 },
  { id: "e9", kind: "buy", actor: "erin.near", paktId: "stackers", detail: "0.4 ETH at $2,041", secondsAgo: 5_400 },
  { id: "e10", kind: "left", actor: "heidi.near", paktId: "wagmi", detail: "left with $412", secondsAgo: 7_200 },
  { id: "e11", kind: "vote", actor: "dave.near", paktId: "nightowls", detail: "Raise budget to $2,500 · 2/4 yes", secondsAgo: 10_800 },
  { id: "e12", kind: "settled", actor: "wagmi", paktId: "wagmi", detail: "+$640 · trader $96 · platform $6.40", secondsAgo: 14_400 },
  { id: "e13", kind: "sell", actor: "alice.near", paktId: "degens", detail: "150 NEAR at $5.52", secondsAgo: 21_600 },
  { id: "e14", kind: "joined", actor: "grace.near", paktId: "degens", detail: "joined with $1,000", secondsAgo: 43_200 },
  { id: "e15", kind: "buy", actor: "grace.near", paktId: "slowcookers", detail: "50 USDC → 9.2 NEAR", secondsAgo: 64_800 },
];
