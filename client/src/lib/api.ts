// Typed fetchers for the pakt backend. Amounts are u128 decimal strings; value/profit/budget are usd e6.
import { API_URL } from "./config";

export type Page<T> = { items: T[]; next: number | null };
export type JoinMode = "Open" | "Invite";

/** data per event kind, as backend chain.ts FIELDS serves it */
export type EventFields = {
  pakt_created: { name: string; vault: string; dao: string; creator: string; join_mode: JoinMode };
  deposit: { account: string; amount: string; shares: string; value: string };
  leave: { account: string; shares: string; payouts: { token: string; amount: string }[] };
  offer: { trader: string; budget: string; max_per_trade: string; fee_bps: number; stop_loss_bps: number; expires_at_ms: string };
  hired: { trader: string };
  declined: { trader: string };
  fired: { trader: string };
  fire_pending: { trader: string };
  cap_set: { budget: string; max_per_trade: string };
  trade: { trader: string; token_in: string; amount_in: string; token_out: string; amount_out: string; value: string };
  /** share_price, hwm: usd e6 per 1e12 shares */
  settled: { share_price: string; hwm: string; profit: string; trader_fee_shares: string; platform_fee_shares: string };
  paused: { reason: string };
  resumed: Record<string, never>;
  /** op is dropped when null */
  unlocked: { op?: string; flows: number };
  member_synced: { account: string; added: boolean };
  claim: { account: string; token: string; amount: string };
  dex_iou: { account: string };
  reconciled: { token: string; amount: string };
  orphan_swept: { platform: string; shares: string; value: string };
};
export type EventKind = keyof EventFields;

type EventBase = {
  id: number; height: number; ts_ms: number; tx_hash: string; receipt_id: string;
  /** factory or vault that logged it */
  emitter: string; vault: string;
  /** data.account || data.trader || data.creator */
  actor: string;
};
/** narrows on kind: `if (e.kind === "trade") e.data.token_in` */
export type PaktEvent = { [K in EventKind]: EventBase & { kind: K; data: EventFields[K] } }[EventKind];

/** info is {} until the factory's pakt_created lands */
export type PaktRow = { id: number; vault: string; created_at: number; info: Partial<EventFields["pakt_created"]> };

export type Terms = Partial<{ budget: string; max_per_trade: string; fee_bps: number; stop_loss_bps: number }>;
export type CloneConfig = { vault: string; name: string; dao: string; creator: string; join_mode: JoinMode; trader: string | null; terms: Terms };
export type Tenure = { vault: string; hired_at: number; fired_at: number | null; terms: Terms; pnl: string; volume: string; trades: number };
export type TraderRecord = { trader: string; pnl: string; volume: string; trades: number; live: number; pakts: Tenure[] };

export type LeaderTrader = { trader: string; pnl: string; volume: string; trades: number };
/** change: fraction, 0.05 = +5% */
export type LeaderPakt = { vault: string; from_share_price: string; to_share_price: string; change: number };
export type Leaderboard = { traders: Page<LeaderTrader>; pakts: Page<LeaderPakt> };
export type Range = "7d" | "30d" | "all";

/** 2+ distinct traders on one token and side */
export type Alert = { token: string; side: "buy" | "sell"; traders: string[]; count: number; total_value: string; first_at: number; last_at: number };

/** before: feeds take the last event id, rankings the `next` offset */
export type PageQuery = { limit?: number; before?: number };

async function get<T>(path: string, q: Record<string, string | number | undefined> = {}): Promise<T> {
  const qs = new URLSearchParams(Object.entries(q).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])));
  const res = await fetch(`${API_URL}${path}${qs.size ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`${path}: ${res.status} ${(await res.json().catch(() => null))?.error ?? ""}`);
  return res.json();
}
// single-item routes answer 404 for unknown ids
const orNull = <T>(p: Promise<T>) => p.catch((e: Error) => (/: 404 /.test(e.message) ? null : Promise.reject(e)));
const enc = encodeURIComponent;

export const feed = (q: PageQuery & { kind?: EventKind } = {}) => get<Page<PaktEvent>>("/feed", q);
export const paktFeed = (vault: string, q: PageQuery = {}) => get<Page<PaktEvent>>(`/pakts/${enc(vault)}/feed`, q);
export const accountFeed = (account: string, q: PageQuery = {}) => get<Page<PaktEvent>>(`/accounts/${enc(account)}/feed`, q);
export const pakts = (q: PageQuery = {}) => get<Page<PaktRow>>("/pakts", q);
export const pakt = (vault: string) => orNull(get<PaktRow>(`/pakts/${enc(vault)}`));
export const paktConfig = (vault: string) => orNull(get<CloneConfig>(`/pakts/${enc(vault)}/config`));
export const trader = (account: string) => get<TraderRecord>(`/traders/${enc(account)}`);
export const leaderboard = (q: PageQuery & { range?: Range } = {}) => get<Leaderboard>("/leaderboard", q);
/** window like 15m, 1h, 7d; max 30d */
export const alerts = (q: PageQuery & { window?: string } = {}) => get<Page<Alert>>("/alerts", q);

/** testnet faucet: mints test tokens to the account; throws the server's message */
export async function requestTokens(account: string): Promise<void> {
  const res = await fetch(`${API_URL}/faucet?account=${enc(account)}`, { method: "POST" });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `faucet: ${res.status}`);
}
