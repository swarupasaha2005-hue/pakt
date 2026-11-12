// run: bun src/lib/search/match.check.ts
import assert from "node:assert/strict";
import type { PaktInfo, TokenPrice } from "@/lib/home/data";
import { match } from "./match";

const tokens = [{ id: "tbtc.x.testnet", symbol: "tBTC" }, { id: "tnear.x.testnet", symbol: "tNEAR" }] as TokenPrice[];
const pakts = [
  { name: "moon", vault: "moon.pakt.testnet", trader: { account: "bob.testnet" } },
  { name: "sun", vault: "sun.pakt.testnet", trader: { account: "bob.testnet" } },
  { name: "dawn", vault: "dawn.pakt.testnet", trader: null },
] as unknown as PaktInfo[];
assert.deepEqual(match("BTC", tokens, pakts).tokens.map((t) => t.symbol), ["tBTC"]);
assert.deepEqual(match("o", tokens, pakts).pakts.map((p) => p.name), ["moon"]);
assert.deepEqual(match("", tokens, pakts).traders, ["bob.testnet"]); // deduped
assert.equal(match("", tokens, pakts, 2).pakts.length, 2);
console.log("search match ok");
