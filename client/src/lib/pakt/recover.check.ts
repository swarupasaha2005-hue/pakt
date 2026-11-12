// run: bun src/lib/pakt/recover.check.ts
import assert from "node:assert/strict";
import type { VaultState } from "@/lib/near/contracts";
import { recoveries } from "./recover";

const base = { op: null, op_since_ms: 0, fire_pending: false, dex_synced: true, at_dex: [["t.near", "5"]], dex_iou: [["t.near", "0"]], suspense: [] } as unknown as VaultState;
const labels = (s: Partial<VaultState>, now = 0, acct: string | null = null, pend: string[] = []) => recoveries("v", { ...base, ...s }, now, acct, pend).map((f) => f.label);

assert.deepEqual(labels({}), [], "healthy vault, at_dex while synced is normal trading");
assert.deepEqual(labels({ dex_synced: false }), ["Recover from Ref"]);
assert.deepEqual(labels({ dex_iou: [["t.near", "1"]], dex_synced: false }), ["Recover from Ref"], "one row per token");
assert.deepEqual(labels({ fire_pending: true }), ["Finish fire"]);
assert.deepEqual(labels({ op: "Trade", fire_pending: true }, 60_000), [], "busy and fresh: wait");
assert.deepEqual(labels({ op: "Trade", fire_pending: true }, 600_000), ["Unlock vault"], "stale lock first, others wait for it");
assert.deepEqual(labels({ suspense: [["t.near", "3"]] }), ["Reconcile"]);
assert.deepEqual(labels({}, 0, "me", ["me"]), ["Retry DAO sync"]);
assert.deepEqual(labels({}, 0, "you", ["me"]), []);
console.log("recover ok");
