import type { Pakt, Token } from "./mock/types";

/** contract slippage cap, percent */
export const MAX_SLIPPAGE = 3;

type Order = {
  side: "buy" | "sell";
  usd: number;
  token: Token;
  /** null = solo */
  pakt: Pakt | null;
  slippage: number;
  cash: number;
  /** usd value already held, caps sells */
  held: number;
};

/** first rule the vault contract would reject the order on, or null */
export function tradeError({ side, usd, token, pakt, slippage, cash, held }: Order) {
  if (!token.allowed) return "Token not allowed";
  if (pakt?.paused) return "Trading paused";
  if (slippage > MAX_SLIPPAGE) return "Slippage too high";
  if (!usd) return null;
  if (pakt && usd > pakt.maxPerTrade) return "Over max per trade";
  if (side === "sell") return usd > held ? `Not enough ${token.symbol}` : null;
  if (pakt) return usd > pakt.budget - pakt.budgetUsed ? "Over budget" : null;
  return usd > cash ? "Not enough cash" : null;
}
