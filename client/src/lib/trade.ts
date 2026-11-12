// Trader order math against the vault rules (contracts/vault/src/trade.rs). Amounts raw, values usd e6.
import { BASE_TOKEN, token } from "./config";
import { usdE6, type PriceData, type VaultState } from "./near/contracts";

/** vault oracle floor: min_out is raised to oracle price minus 2% anyway */
export const MAX_SLIPPAGE_BPS = 200;

/** raw units of `id` worth `value` usd e6 at oracle price; null without a price */
export function rawFor(prices: PriceData, id: string, value: bigint): bigint | null {
  const p = prices.prices.find((x) => x.asset_id === id)?.price;
  if (!p || p.multiplier === "0") return null;
  return (value * BigInt(10) ** BigInt(p.decimals)) / (BigInt(p.multiplier) * BigInt(1_000_000));
}

/** oracle quote for the output minus slippage; null without prices */
export function minOut(prices: PriceData, tokenIn: string, amountIn: string, tokenOut: string, slippageBps: number): string | null {
  const v = usdE6(prices, tokenIn, amountIn);
  const out = v === null ? null : rawFor(prices, tokenOut, v);
  return out === null ? null : ((out * BigInt(10_000 - slippageBps)) / BigInt(10_000)).toString();
}

/** ref pool of the non-base side; trades always go through the base token, so one side must be it */
export function poolFor(tokenIn: string, tokenOut: string): number | null {
  if (tokenIn === BASE_TOKEN.id) return token(tokenOut)?.pool ?? null;
  if (tokenOut === BASE_TOKEN.id) return token(tokenIn)?.pool ?? null;
  return null;
}

type Order = {
  state: VaultState;
  account: string | null;
  tokenIn: string;
  tokenOut: string;
  /** raw tokenIn, null = nothing entered */
  amountIn: string | null;
  /** usd e6 of amountIn, null = no price */
  value: bigint | null;
  slippageBps: number;
  now: number;
};

/** first rule the vault would reject the order on, or null */
export function tradeError({ state, account, tokenIn, tokenOut, amountIn, value, slippageBps, now }: Order) {
  const t = state.trader;
  if (!t || t.account !== account) return "Only the hired pakter";
  if (t.paused) return "Trading paused";
  if (state.fire_pending) return "Fire pending";
  if (now < state.trade_after_ms) return `Trading opens in ${Math.ceil((state.trade_after_ms - now) / 60_000)}m`;
  if (state.op) return "Vault busy, retry";
  if (slippageBps > MAX_SLIPPAGE_BPS) return "Slippage over 2%";
  if (tokenIn === tokenOut) return "Same token";
  if (poolFor(tokenIn, tokenOut) === null) return "No pool";
  if (!amountIn) return null;
  if (value === null) return "No oracle price";
  if (BigInt(amountIn) === BigInt(0)) return "Amount too small";
  const bal = state.balances.find(([id]) => id === tokenIn)?.[1] ?? "0";
  if (BigInt(amountIn) > BigInt(bal)) return `Not enough ${token(tokenIn)?.symbol ?? tokenIn}`;
  if (value > BigInt(t.max_per_trade)) return "Over max per trade";
  if (BigInt(t.budget_used) + value > BigInt(t.budget)) return "Over budget";
  return null;
}
