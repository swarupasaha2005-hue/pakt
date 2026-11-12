// self-check: bun src/lib/trade.check.ts
import assert from "node:assert/strict";
import type { PriceData, VaultState } from "./near/contracts";
import { toRaw } from "./pakt/units";
import { minOut, poolFor, rawFor, tradeError } from "./trade";

const USDC = "tusdc.pakt-0mxhjh.testnet";
const BTC = "tbtc.pakt-0mxhjh.testnet";
const NEAR = "tnear.pakt-0mxhjh.testnet";
// live oracle shape: tBTC $71,594.355, tNEAR $3.41315
const prices = {
  timestamp: "0", recency_duration_sec: 180,
  prices: [
    { asset_id: USDC, price: { multiplier: "1", decimals: 6 } },
    { asset_id: BTC, price: { multiplier: "71594355", decimals: 11 } },
    { asset_id: NEAR, price: { multiplier: "341315", decimals: 29 } },
  ],
} as PriceData;
const trader = { account: "t.testnet", fee_bps: 1000, budget: "20000000", max_per_trade: "10000000", budget_used: "5000000", stop_loss_bps: 5000, paused: false };
const state = { balances: [[USDC, "50000000"], [BTC, "0"]], trader, trade_after_ms: 0, op: null, fire_pending: false } as unknown as VaultState;
const base = { state, account: "t.testnet", tokenIn: USDC, tokenOut: BTC, amountIn: "5000000", value: BigInt(5_000_000), slippageBps: 100, now: 1 };

assert.equal(rawFor(prices, USDC, BigInt(5_000_000)), BigInt(5_000_000));
// $5 of tBTC at 2% off: 6983 sats → 6843
assert.equal(minOut(prices, USDC, "5000000", BTC, 200), "6843");
assert.equal(poolFor(USDC, BTC), 2958);
assert.equal(poolFor(NEAR, USDC), 2959);
assert.equal(poolFor(BTC, NEAR), null);
assert.equal(toRaw("1.5", 6), "1500000");
assert.equal(toRaw("0.0000001", 6), null);
assert.equal(toRaw("abc", 6), null);

assert.equal(tradeError(base), null);
assert.equal(tradeError({ ...base, account: "x.testnet" }), "Only the hired trader");
assert.equal(tradeError({ ...base, state: { ...state, trader: { ...trader, paused: true } } }), "Trading paused");
assert.equal(tradeError({ ...base, state: { ...state, trade_after_ms: 120_001 } }), "Trading opens in 2m");
assert.equal(tradeError({ ...base, slippageBps: 300 }), "Slippage over 2%");
assert.equal(tradeError({ ...base, tokenIn: BTC, tokenOut: NEAR }), "No pool");
assert.equal(tradeError({ ...base, amountIn: "60000000" }), "Not enough tUSDC");
assert.equal(tradeError({ ...base, value: BigInt(11_000_000) }), "Over max per trade");
assert.equal(tradeError({ ...base, value: BigInt(10_000_000), state: { ...state, trader: { ...trader, budget_used: "15000000" } } }), "Over budget");
assert.equal(tradeError({ ...base, value: null }), "No oracle price");
console.log("trade ok");
