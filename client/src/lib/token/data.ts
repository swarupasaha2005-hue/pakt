// Token page loaders: config lookup, ref pool reserves, trade events and pakt holdings for one token.
import { feed, type PaktEvent } from "../api";
import { DEX, rpcFetch, TOKENS } from "../config";
import { usdE6 } from "../near/contracts";
import { usdNum, type PaktInfo } from "../home/data";

export type TradeEvent = Extract<PaktEvent, { kind: "trade" }>;

/** display names by symbol; config carries none */
export const NAMES: Record<string, string> = { tUSDC: "Test USD Coin", tBTC: "Test Bitcoin", tNEAR: "Test NEAR" };

/** case-insensitive symbol → config token */
export const bySymbol = (symbol: string) => TOKENS.find((t) => t.symbol.toLowerCase() === symbol.toLowerCase());

export const addressUrl = (id: string) => `https://testnet.nearblocks.io/address/${id}`;

export type Pool = { pool_kind: string; token_account_ids: string[]; amounts: string[]; total_fee: number };
/** ref get_pool view, same rpc call shape as near/contracts view() */
export async function getPool(poolId: number): Promise<Pool> {
  const res = await rpcFetch({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: "pakt", method: "query",
      params: { request_type: "call_function", finality: "final", account_id: DEX, method_name: "get_pool", args_base64: btoa(JSON.stringify({ pool_id: poolId })) },
    }),
  });
  const r = await res.json();
  const err = r.error?.data ?? r.error?.message ?? r.result?.error;
  if (err) throw new Error(`${DEX}.get_pool: ${typeof err === "string" ? err : JSON.stringify(err)}`);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(r.result.result as number[])));
}

export const touches = (e: PaktEvent, id: string): e is TradeEvent => e.kind === "trade" && (e.data.token_in === id || e.data.token_out === id);

// shortcut: newest 200 trades only (api max), page with `before` once volume grows
export const loadTrades = (id: string) => feed({ kind: "trade", limit: 200 }).then((p) => p.items.filter((e) => touches(e, id)));

/** usd per whole token implied by a trade: value / amount of this token's leg */
export function impliedPrice(e: TradeEvent, id: string, decimals: number) {
  const raw = e.data.token_in === id ? e.data.amount_in : e.data.amount_out;
  const n = Number(raw) / 10 ** decimals;
  return n > 0 ? usdNum(e.data.value) / n : null;
}

/** raw amount (balances + at_dex) and usd per pakt that whitelists the token, largest first */
export function holdersOf(id: string, list: PaktInfo[]) {
  return list
    .flatMap((p) => {
      const i = p.state.balances.findIndex(([t]) => t === id);
      if (i < 0) return [];
      const raw = (BigInt(p.state.balances[i][1]) + BigInt(p.state.at_dex[i]?.[1] ?? "0")).toString();
      const v = usdE6(p.prices, id, raw);
      return [{ pakt: p, raw, value: v === null ? null : usdNum(v) }];
    })
    .toSorted((a, b) => (b.value ?? 0) - (a.value ?? 0));
}

/** mainnet spot pair each test token tracks (same pairs the backend relay reads) */
export const PAIRS: Record<string, string> = { tUSDC: "USDC-USDT", tBTC: "BTC-USD", tNEAR: "NEAR-USD" };
// coinbase lists no USDC-USD market; USDC-USDT is read as the inverse of USDT-USDC
const INVERTED: Record<string, string> = { "USDC-USDT": "USDT-USDC" };
export const FRAMES = { "15m": 900, "1h": 3600, "6h": 21600, "1D": 86400 } as const;
export type Frame = keyof typeof FRAMES;
export type Candle = { time: number; open: number; high: number; low: number; close: number };

/** coinbase rows are [time, low, high, open, close, volume], newest first */
export const toCandles = (rows: number[][], invert = false): Candle[] =>
  rows
    .map(([time, low, high, open, close]) =>
      invert ? { time, open: 1 / open, high: 1 / low, low: 1 / high, close: 1 / close } : { time, open, high, low, close })
    .toSorted((a, b) => a.time - b.time);

/** keyless public endpoint with CORS *, up to 300 candles */
export async function loadCandles(pair: string, frame: Frame): Promise<Candle[]> {
  const product = INVERTED[pair] ?? pair;
  const res = await fetch(`https://api.exchange.coinbase.com/products/${product}/candles?granularity=${FRAMES[frame]}`);
  if (!res.ok) throw new Error(`candles ${res.status}`);
  return toCandles(await res.json(), product !== pair);
}

export const WINDOWS = { "5M": 1, "1H": 12, "4H": 48, "1D": 288 } as const; // in 5-minute candles
export type Stats = { last: number; vol24: number; change: Record<keyof typeof WINDOWS, number | null> };

/** 5-minute coinbase rows, newest first → last price, 24h usd volume, % change per window */
export function stats(rows: number[][], invert = false): Stats | null {
  if (!rows.length) return null;
  const px = (v: number) => (invert ? 1 / v : v);
  const last = px(rows[0][4]);
  const vol24 = rows.slice(0, 288).reduce((a, r) => a + r[5] * r[4], 0); // quote-currency volume ≈ usd for both orders
  const change = Object.fromEntries(
    Object.entries(WINDOWS).map(([k, n]) => [k, rows[n - 1] ? (last / px(rows[n - 1][3]) - 1) * 100 : null]),
  ) as Stats["change"];
  return { last, vol24, change };
}

export async function loadStats(pair: string): Promise<Stats | null> {
  const product = INVERTED[pair] ?? pair;
  const res = await fetch(`https://api.exchange.coinbase.com/products/${product}/candles?granularity=300`);
  if (!res.ok) throw new Error(`candles ${res.status}`);
  return stats(await res.json(), product !== pair);
}
