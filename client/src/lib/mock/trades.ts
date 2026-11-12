import { pickPakt } from "./holders";
import { me } from "./me";
import { rng } from "./rng";
import { traders } from "./traders";
import type { Token } from "./types";

export type Trade = {
  id: string;
  account: string;
  paktId: string | null;
  side: "buy" | "sell";
  usd: number;
  price: number;
  secondsAgo: number;
};

const ACCOUNTS = [...traders.map((t) => t.account), me.account];

export function trades(token: Token): Trade[] {
  const rand = rng(`trades${token.symbol}`);
  return Array.from({ length: 24 }, (_, i): Trade => {
    const account = ACCOUNTS[Math.floor(rand() * ACCOUNTS.length)];
    return {
      id: `${token.symbol}-${i}`,
      account,
      paktId: pickPakt(account, token, rand),
      side: rand() < 0.55 ? "buy" : "sell",
      usd: Math.round(10 + rand() ** 2 * 2_000),
      price: token.price * (0.98 + rand() * 0.04),
      secondsAgo: Math.floor(rand() * 86_000),
    };
  }).sort((a, b) => a.secondsAgo - b.secondsAgo);
}

/** 24h buy vs sell split for the About card */
export function flow(token: Token) {
  const rand = rng(`flow${token.symbol}`);
  const buyShare = 0.35 + rand() * 0.3;
  const count = Math.round(token.holders * 0.6);
  const traderCount = Math.round(token.holders * 0.35);
  return {
    buys: Math.round(count * buyShare),
    sells: Math.round(count * (1 - buyShare)),
    buyVol: token.volume24h * buyShare,
    sellVol: token.volume24h * (1 - buyShare),
    buyers: Math.round(traderCount * (buyShare + 0.05)),
    sellers: Math.round(traderCount * (0.95 - buyShare)),
  };
}
