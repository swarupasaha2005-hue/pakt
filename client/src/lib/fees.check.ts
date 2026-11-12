// run: bun src/lib/fees.check.ts (PAKT.md §5 examples)
import assert from "node:assert/strict";
import { feeSplit } from "./fees";

assert.deepEqual(feeSplit(120, 20), { trader: 24, platform: 1.2, members: 94.8 });
assert.deepEqual(feeSplit(-120, 20), { trader: 0, platform: 0, members: 0 });
assert.deepEqual(feeSplit(600 - 600, 20), { trader: 0, platform: 0, members: 0 });
console.log("fees ok");
