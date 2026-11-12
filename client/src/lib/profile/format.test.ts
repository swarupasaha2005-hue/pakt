// run: bun src/lib/profile/format.test.ts
import assert from "node:assert/strict";
import type { PaktEvent } from "../api";
import { detail, isAccountId, paktName, tokenAmount } from "./format";

for (const ok of ["pakt-0mxhjh.testnet", "ab", "a_b.near", "a".repeat(64), "livetest.pakt.pakt-0mxhjh.testnet"]) assert.ok(isAccountId(ok), ok);
for (const bad of ["a", "A.near", "a..b", ".a", "a.", "a-.near", "-a", "a b", "a".repeat(65), "../x"]) assert.ok(!isAccountId(bad), bad);
assert.equal(paktName("livetest.pakt.pakt-0mxhjh.testnet"), "livetest");
assert.equal(tokenAmount("tbtc.pakt-0mxhjh.testnet", "6940"), "0.0000694 tBTC");

const base = { id: 1, height: 1, ts_ms: 0, tx_hash: "", receipt_id: "", emitter: "v", vault: "v", actor: "a" };
const trade = { ...base, kind: "trade", data: { trader: "a", token_in: "tusdc.pakt-0mxhjh.testnet", amount_in: "5000000", token_out: "tbtc.pakt-0mxhjh.testnet", amount_out: "6940", value: "5000000" } } as PaktEvent;
assert.equal(detail(trade), "5 tUSDC → 0.0000694 tBTC · $5.00");
console.log("profile format ok");
