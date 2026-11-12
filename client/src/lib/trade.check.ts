// self-check: bun src/lib/trade.check.ts
import assert from "node:assert/strict";
import { pakts } from "./mock/pakts";
import { tokens } from "./mock/tokens";
import { tradeError } from "./trade";

const near = tokens[0];
const ref = tokens.find((t) => t.symbol === "REF")!;
const night = pakts.find((p) => p.id === "nightshift")!;
const low = pakts.find((p) => p.id === "lowtide")!;
const base = { side: "buy", usd: 100, token: near, pakt: night, slippage: 0.5, cash: 1_000, held: 0 } as const;

assert.equal(tradeError(base), null);
assert.equal(tradeError({ ...base, usd: 0 }), null);
assert.equal(tradeError({ ...base, token: ref }), "Token not allowed");
assert.equal(tradeError({ ...base, pakt: low }), "Trading paused");
assert.equal(tradeError({ ...base, slippage: 5 }), "Slippage too high");
assert.equal(tradeError({ ...base, usd: 151 }), "Over max per trade");
assert.equal(tradeError({ ...base, pakt: { ...night, budgetUsed: 950 } }), "Over budget");
assert.equal(tradeError({ ...base, pakt: null, usd: 1_001 }), "Not enough cash");
assert.equal(tradeError({ ...base, side: "sell", held: 50 }), "Not enough NEAR");
console.log("trade ok");
