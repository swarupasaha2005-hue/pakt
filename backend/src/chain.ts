// Block sources (neardata, NEAR RPC) and NEP-297 pakt event extraction.

export type Outcome = { id: string; outcome: { executor_id: string; logs: string[]; status: unknown } };
export type Receipt = { tx_hash: string; execution_outcome: Outcome };
export type Header = { height: number; timestamp: number }; // timestamp in ns, f64 is fine for ms
export type Block = { block: { header: Header }; shards: { receipt_execution_outcomes: Receipt[] }[] };

export type NewEvent = {
  height: number; ts_ms: number; tx_hash: string; receipt_id: string; log_idx: number; data_idx: number;
  emitter: string; vault: string; kind: string; actor: string; data: string;
};

// Served fields per kind. Kinds outside this list are dropped at ingest.
export const FIELDS: Record<string, string[]> = {
  pakt_created: ["name", "vault", "dao", "creator", "join_mode"],
  deposit: ["account", "amount", "shares", "value"],
  leave: ["account", "shares", "payouts"],
  offer: ["trader", "budget", "max_per_trade", "fee_bps", "stop_loss_bps", "expires_at_ms"],
  hired: ["trader"], declined: ["trader"], fired: ["trader"],
  cap_set: ["budget", "max_per_trade"],
  trade: ["trader", "token_in", "amount_in", "token_out", "amount_out", "value"],
  settled: ["share_price", "hwm", "profit", "trader_fee_shares", "platform_fee_shares"],
  paused: ["reason"], resumed: [], unlocked: ["op", "flows"], fire_pending: ["trader"],
  member_synced: ["account", "added"],
  claim: ["account", "token", "amount"],
  dex_iou: ["account"], reconciled: ["token", "amount"], orphan_swept: ["platform", "shares", "value"],
};

export function parseLog(line: string): { kind: string; data: unknown[] } | null {
  if (!line.startsWith("EVENT_JSON:")) return null;
  try {
    const ev = JSON.parse(line.slice(11));
    if (ev?.standard !== "pakt" || typeof ev.event !== "string" || !(ev.event in FIELDS) || !Array.isArray(ev.data)) return null;
    return { kind: ev.event, data: ev.data };
  } catch {
    return null;
  }
}

// Failure and "Unknown" both mean the receipt's state changes did not land.
const succeeded = (s: unknown) => typeof s === "object" && s !== null && !("Failure" in s);

const str = (v: unknown) => (typeof v === "string" ? v : "");

// Only the factory or a direct `<name>.<factory>` vault is trusted; `evilpakt.testnet` and `x.a.pakt.testnet` are not.
export const trusted = (who: string, factory: string) =>
  who === factory || (who.endsWith("." + factory) && !who.slice(0, -factory.length - 1).includes("."));

export function events(b: Block, factory: string): NewEvent[] {
  const out: NewEvent[] = [];
  const { height, timestamp } = b.block.header;
  for (const sh of b.shards ?? []) {
    for (const r of sh.receipt_execution_outcomes ?? []) {
      const o = r.execution_outcome.outcome;
      if (!trusted(o.executor_id, factory) || !succeeded(o.status)) continue;
      o.logs.forEach((line, li) => {
        const ev = parseLog(line);
        ev?.data.forEach((d, di) => {
          if (typeof d !== "object" || d === null) return;
          const f = d as Record<string, unknown>;
          out.push({
            height, ts_ms: Math.floor(timestamp / 1e6), tx_hash: r.tx_hash, receipt_id: r.execution_outcome.id,
            log_idx: li, data_idx: di, emitter: o.executor_id,
            vault: o.executor_id === factory ? str(f.vault) : o.executor_id,
            kind: ev.kind, actor: str(f.account) || str(f.trader) || str(f.creator), data: JSON.stringify(d),
          });
        });
      });
    }
  }
  return out;
}

export class Budget extends Error {} // per-invocation subrequest budget used up: stop, not a failure
export class BadBlock extends Error {} // oversize or unparsable: retrying cannot help

const MAX_BYTES = 8 << 20;

async function readCapped(res: Response): Promise<string> {
  if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) {
    await res.body?.cancel();
    throw new BadBlock("response too large");
  }
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let text = "";
  for (let n = 0; ; ) {
    const { done, value } = await reader.read();
    if (done) return text + dec.decode();
    if ((n += value.byteLength) > MAX_BYTES) {
      await reader.cancel();
      throw new BadBlock("response too large");
    }
    text += dec.decode(value, { stream: true });
  }
}

// Upstream counts subrequests against a budget and bounds time and size of each.
export class Upstream {
  calls = 0;
  constructor(private max: number) {}
  // accept: statuses whose body still is the answer, e.g. 422 for a JSON-RPC handler error
  async json(url: string, init: RequestInit = {}, accept: number[] = []): Promise<unknown> {
    if (this.calls >= this.max) throw new Budget("subrequest budget");
    this.calls++;
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    const text = await readCapped(res);
    // path only: the url may carry the api key
    if (!res.ok && !accept.includes(res.status)) throw new Error(`${new URL(url).pathname}: ${res.status} ${text.slice(0, 200)}`);
    try {
      return JSON.parse(text);
    } catch {
      throw new BadBlock(`${new URL(url).pathname}: bad json`);
    }
  }
}

// A rejected key (401/403) must not stop indexing: go keyless (free tier) for 10 min, then try the key again.
let keyOffUntil = 0;
export const resetKey = () => (keyOffUntil = 0); // tests
const useKey = (key: string) => (key && Date.now() >= keyOffUntil ? key : "");
async function keyed<T>(key: string, run: (key: string) => Promise<T>): Promise<T> {
  const k = useKey(key);
  try {
    return await run(k);
  } catch (e) {
    // 401/403 bad key, 402 key out of credit: go keyless for a while
    if (!k || !/: 40[123] /.test(String(e))) throw e;
    keyOffUntil = Date.now() + 600_000;
    return run("");
  }
}

export interface Source {
  final(up: Upstream): Promise<number>;
  block(up: Upstream, h: number): Promise<Block | null>; // null = skipped height
}

export class Neardata implements Source {
  constructor(private base: string, private key = "") {}
  // query, not Bearer: neardata redirects drop headers
  private get = (up: Upstream, path: string) =>
    keyed(this.key, (k) => up.json(this.base + path + (k ? `?apiKey=${encodeURIComponent(k)}` : "")));
  async final(up: Upstream) {
    return ((await this.get(up, "/v0/last_block/final")) as Block).block.header.height;
  }
  async block(up: Upstream, h: number) {
    return (await this.get(up, `/v0/block/${h}`)) as Block | null;
  }
}

type RpcBlock = { header: Header; chunks: { chunk_hash: string; height_included: number }[] };

// Rpc polls a NEAR JSON-RPC node, e.g. a local sandbox where neardata does not exist.
// shortcut: one tx_status per tx, fine for a sandbox; a block with more txs than the budget never fits.
export class Rpc implements Source {
  constructor(private url: string, private key = "") {}
  async call<T>(up: Upstream, method: string, params: object): Promise<T | null> {
    const body = JSON.stringify({ jsonrpc: "2.0", id: "pakt", method, params });
    const res = (await keyed(this.key, (k) => {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (k) headers.authorization = `Bearer ${k}`;
      return up.json(this.url, { method: "POST", headers, body }, [422]);
    })) as {
      result?: T; error?: { cause?: { name?: string }; message?: string; data?: unknown };
    };
    if (res.error?.cause?.name === "UNKNOWN_BLOCK") return null;
    if (res.error) throw new Error(`${method}: ${res.error.cause?.name} ${res.error.message} ${JSON.stringify(res.error.data)}`);
    return res.result as T;
  }
  async final(up: Upstream) {
    return (await this.call<RpcBlock>(up, "block", { finality: "final" }))!.header.height;
  }
  // Every receipt of the block's txs, stamped with this block: callbacks in later blocks get the tx's block.
  async block(up: Upstream, h: number): Promise<Block | null> {
    const rb = await this.call<RpcBlock>(up, "block", { block_id: h });
    if (!rb) {
      // unknown below the node's earliest block is pruned history, not a skipped height: fail loud
      const st = await this.call<{ sync_info: { earliest_block_height: number } }>(up, "status", []);
      if (h < (st?.sync_info.earliest_block_height ?? 0)) throw new Error(`block ${h} pruned by the node, use an archival rpc`);
      return null;
    }
    const outs: Receipt[] = [];
    const seen = new Set<string>();
    for (const c of rb.chunks) {
      if (c.height_included !== h) continue; // chunk carried over from an earlier block
      const ch = await this.call<{ transactions: { hash: string; signer_id: string }[] }>(up, "chunk", { chunk_id: c.chunk_hash });
      for (const tx of ch?.transactions ?? []) {
        const st = await this.call<{ receipts_outcome: Outcome[] }>(up, "EXPERIMENTAL_tx_status", {
          tx_hash: tx.hash, sender_account_id: tx.signer_id, wait_until: "FINAL",
        });
        for (const o of st?.receipts_outcome ?? []) {
          if (seen.has(o.id)) continue;
          seen.add(o.id);
          outs.push({ tx_hash: tx.hash, execution_outcome: o });
        }
      }
    }
    return { block: { header: rb.header }, shards: [{ receipt_execution_outcomes: outs }] };
  }
}
