import { me } from "./me";
import { pakts } from "./pakts";
import { positions } from "./positions";
import { rng } from "./rng";
import { traders } from "./traders";
import type { Token } from "./types";

export type Holding = {
  account: string;
  /** null = solo vault */
  paktId: string | null;
  /** token units */
  amount: number;
  avgEntry: number;
  heldSeconds: number;
};

const ACCOUNTS = traders.map((t) => t.account);

/** a trader's pakt for this pick, or solo; pakts only hold whitelisted tokens */
export function pickPakt(account: string, token: Token, rand: () => number) {
  const own = pakts.filter((p) => p.trader === account);
  if (!token.allowed || !own.length || rand() < 0.4) return null;
  return own[Math.floor(rand() * own.length)].id;
}

export function holders(token: Token): Holding[] {
  const rand = rng(`holders${token.symbol}`);
  const mine = positions
    .filter((p) => p.open && p.symbol === token.symbol)
    .map((p) => ({ account: me.account, paktId: p.paktId, amount: p.amount, avgEntry: p.avgEntry, heldSeconds: 2 * 86_400 }));
  return ACCOUNTS.filter(() => rand() < 0.75)
    .map((account): Holding => {
      const usdSize = 50 + rand() ** 2 * 4_000;
      return {
        account,
        paktId: pickPakt(account, token, rand),
        amount: usdSize / token.price,
        avgEntry: token.price * (0.8 + rand() * 0.4),
        heldSeconds: Math.floor(3_600 + rand() * 30 * 86_400),
      };
    })
    .concat(mine)
    .sort((a, b) => b.amount - a.amount);
}

/** pakt holding the most of a token */
export const topPakt = (token: Token) => holders(token).find((h) => h.paktId);
