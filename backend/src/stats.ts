// Alerts and leaderboard math over stored rows. Amounts are u128 decimal strings; value/profit are usd e6.
import type { Row } from "./store";

const num = (v: unknown) => (typeof v === "string" && /^-?\d{1,40}$/.test(v) ? BigInt(v) : 0n); // junk counts as 0
const fields = (r: Row): Record<string, unknown> => {
  try {
    return JSON.parse(r.data);
  } catch {
    return {};
  }
};
const str = (v: unknown) => (typeof v === "string" ? v : "");
const cmp = (a: bigint, b: bigint) => (a > b ? 1 : a < b ? -1 : 0);

export type Alert = {
  token: string; side: "buy" | "sell"; traders: string[]; count: number; total_value: string; first_at: number; last_at: number;
};

// alerts groups trades by (token, side) and keeps groups with 2+ distinct traders, biggest crowd first.
export function alerts(trades: Row[]): Alert[] {
  const groups = new Map<string, Alert & { total: bigint }>();
  for (const r of trades) {
    const f = fields(r);
    for (const [token, side] of [[str(f.token_out), "buy"], [str(f.token_in), "sell"]] as const) {
      const k = `${side}:${token}`;
      let a = groups.get(k);
      if (!a) groups.set(k, (a = { token, side, traders: [], count: 0, total_value: "", first_at: r.ts_ms, last_at: r.ts_ms, total: 0n }));
      if (!a.traders.includes(str(f.trader))) a.traders.push(str(f.trader));
      a.count++;
      a.total += num(f.value);
      a.first_at = Math.min(a.first_at, r.ts_ms);
      a.last_at = Math.max(a.last_at, r.ts_ms);
    }
  }
  return [...groups.values()]
    .filter((a) => a.traders.length >= 2)
    .sort((a, b) => b.traders.length - a.traders.length || cmp(b.total, a.total))
    .map(({ total, ...a }) => ({ ...a, total_value: total.toString() }));
}

export type TraderRow = { trader: string; pnl: string; volume: string; trades: number };
export type PaktRow = { vault: string; from_share_price: string; to_share_price: string; change: number };

const PRICE_SCALE = 1_000_000_000_000n; // vault PRICE_SCALE: share_price is usd e6 per 1e12 shares
export const LEADERBOARD_KINDS = ["hired", "fired", "trade", "settled", "deposit"];

// leaderboard takes LEADERBOARD_KINDS rows, all time, oldest first, and ranks activity at or after since.
// Trader pnl = sum of settled.profit while they were the vault's live trader (hired, not yet fired); trade value is volume only.
// Pakt price samples: settled.share_price and deposit value*1e12/shares, since settles only mark new highs.
export function leaderboard(rows: Row[], since: number): { traders: TraderRow[]; pakts: PaktRow[] } {
  const live = new Map<string, string>(); // vault -> live trader
  const traders = new Map<string, { trader: string; pnl: bigint; volume: bigint; trades: number }>();
  const row = (t: string) => {
    let r = traders.get(t);
    if (!r) traders.set(t, (r = { trader: t, pnl: 0n, volume: 0n, trades: 0 }));
    return r;
  };
  const prices = new Map<string, [bigint, bigint]>();
  for (const r of rows) {
    const f = fields(r);
    if (r.kind === "hired") live.set(r.vault, str(f.trader));
    if (r.kind === "fired") live.delete(r.vault); // on_fire emits settled before fired, so that profit is still theirs
    if (r.ts_ms < since) continue;
    let price: bigint | null = null;
    if (r.kind === "trade") {
      const t = row(str(f.trader));
      t.trades++;
      t.volume += num(f.value);
    } else if (r.kind === "settled") {
      const t = live.get(r.vault);
      if (t) row(t).pnl += num(f.profit);
      price = num(f.share_price);
    } else if (r.kind === "deposit" && num(f.shares) > 0n) {
      price = (num(f.value) * PRICE_SCALE) / num(f.shares);
    }
    if (price !== null) prices.set(r.vault, [prices.get(r.vault)?.[0] ?? price, price]);
  }
  const tr = [...traders.values()]
    .sort((a, b) => cmp(b.pnl, a.pnl) || cmp(b.volume, a.volume) || a.trader.localeCompare(b.trader))
    .map((t) => ({ ...t, pnl: t.pnl.toString(), volume: t.volume.toString() }));
  const pr = [...prices]
    .filter(([, [from]]) => from > 0n)
    .map(([vault, [from, to]]) => ({
      vault, from_share_price: from.toString(), to_share_price: to.toString(),
      change: Number(((to - from) * 1_000_000n) / from) / 1e6,
    }))
    .sort((a, b) => b.change - a.change || a.vault.localeCompare(b.vault));
  return { traders: tr, pakts: pr };
}

// Copy pakt: a trader's record per pakt, and the terms a new pakt needs to clone one.
export const COPY_KINDS = ["pakt_created", "offer", "hired", "fired", "cap_set", "trade", "settled"];
const TERMS = ["budget", "max_per_trade", "fee_bps", "stop_loss_bps"] as const;
type Terms = Partial<Record<(typeof TERMS)[number], unknown>>;
const terms = (f: Record<string, unknown>): Terms => Object.fromEntries(TERMS.map((k) => [k, f[k]]));

export type Tenure = { vault: string; hired_at: number; fired_at: number | null; terms: Terms; pnl: string; volume: string; trades: number };

// traderRecord takes COPY_KINDS rows oldest first. pnl = settled.profit while live, as the leaderboard counts it.
export function traderRecord(rows: Row[], trader: string) {
  const offers = new Map<string, Terms>(); // vault -> last offer to this trader
  const live = new Map<string, Tenure & { p: bigint; v: bigint }>();
  const done: Tenure[] = [];
  const close = ({ p, v, ...t }: Tenure & { p: bigint; v: bigint }): Tenure => ({ ...t, pnl: p.toString(), volume: v.toString() });
  for (const r of rows) {
    const f = fields(r), t = live.get(r.vault);
    if (r.kind === "offer" && str(f.trader) === trader) offers.set(r.vault, terms(f));
    else if (r.kind === "hired" && str(f.trader) === trader)
      live.set(r.vault, { vault: r.vault, hired_at: r.ts_ms, fired_at: null, terms: { ...offers.get(r.vault) }, pnl: "0", volume: "0", trades: 0, p: 0n, v: 0n });
    else if (!t) continue;
    else if (r.kind === "settled") t.p += num(f.profit);
    else if (r.kind === "trade") (t.v += num(f.value)), t.trades++;
    else if (r.kind === "cap_set") Object.assign(t.terms, { budget: f.budget, max_per_trade: f.max_per_trade });
    else if (r.kind === "fired") done.push(close({ ...t, fired_at: r.ts_ms })), live.delete(r.vault);
  }
  const pakts = [...done, ...[...live.values()].map(close)].sort((a, b) => b.hired_at - a.hired_at);
  const total = pakts.reduce((a, t) => ({ pnl: a.pnl + num(t.pnl), volume: a.volume + num(t.volume), trades: a.trades + t.trades }), { pnl: 0n, volume: 0n, trades: 0 });
  return { trader, pnl: total.pnl.toString(), volume: total.volume.toString(), trades: total.trades, live: live.size, pakts };
}

// cloneConfig: what a "copy this pakt" form pre-fills. Whitelist and min deposit live on chain: read vault get_state.
export function cloneConfig(rows: Row[], vault: string) {
  let info: Record<string, unknown> | null = null, trader: string | null = null, t: Terms = {};
  const offers = new Map<string, Terms>();
  for (const r of rows) {
    if (r.vault !== vault) continue;
    const f = fields(r);
    if (r.kind === "pakt_created") info = f;
    else if (r.kind === "offer") offers.set(str(f.trader), terms(f));
    else if (r.kind === "hired") (trader = str(f.trader)), (t = { ...(offers.get(trader) ?? {}) });
    else if (r.kind === "cap_set") Object.assign(t, { budget: f.budget, max_per_trade: f.max_per_trade });
    else if (r.kind === "fired") trader = null;
  }
  if (!info) return null;
  const { name, dao, creator, join_mode } = info;
  return { vault, name, dao, creator, join_mode, trader, terms: t };
}
