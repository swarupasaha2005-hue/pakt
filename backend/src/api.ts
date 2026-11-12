// Read API: input validation, routing and canonical cache keys. All routes are GET.
import { FIELDS } from "./chain";
import { COPY_KINDS, LEADERBOARD_KINDS, alerts, cloneConfig, leaderboard, traderRecord } from "./stats";
import { feed, pakts, since, toEvent, type FeedCol } from "./store";

export class BadInput extends Error {}

// NEAR account id rules: 2..64 chars, lowercase parts split by '.', '-' or '_' never leading, trailing or doubled.
const ACCOUNT = /^(?=.{2,64}$)(?:[a-z\d]+[-_])*[a-z\d]+(?:\.(?:[a-z\d]+[-_])*[a-z\d]+)*$/;

// clientKey is the rate-limit and socket-cap key. One IPv6 user owns a whole /64, so key on that, not the address.
export function clientKey(req: Request): string {
  const ip = req.headers.get("cf-connecting-ip") ?? "local";
  if (!ip.includes(":") || ip.includes(".")) return ip;
  const [head, tail] = ip.toLowerCase().split("::");
  const h = head ? head.split(":") : [], t = tail ? tail.split(":") : [];
  const full = tail === undefined ? h : [...h, ...Array(8 - h.length - t.length).fill("0"), ...t];
  return full.slice(0, 4).map((x) => x.replace(/^0+(?=.)/, "")).join(":") + "::/64";
}

export function account(v: string): string {
  if (!ACCOUNT.test(v)) throw new BadInput("bad account id");
  return v;
}

function int(sp: URLSearchParams, key: string, def: number, min: number, max: number): number {
  const s = sp.get(key);
  if (s === null) return def;
  if (!/^\d{1,15}$/.test(s) || +s < min || +s > max) throw new BadInput(`${key} must be an integer ${min}..${max}`);
  return +s;
}

const UNIT = { m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

function windowMs(s: string | null): number {
  const m = /^(\d{1,4})([mhd])$/.exec(s ?? "1h");
  const ms = m ? +m[1] * UNIT[m[2] as keyof typeof UNIT] : 0;
  if (ms < UNIT.m || ms > 30 * UNIT.d) throw new BadInput("window must be like 15m, 1h or 7d, max 30d");
  return ms;
}

export type Route = { ttl: number; params: Record<string, string | number>; run: (db: D1Database) => Promise<unknown> };

// Rankings scan all history: memo per isolate so limit/before variants cannot each force a rescan.
const memo = new Map<string, { at: number; v: unknown }>();
async function memoized<T>(key: string, f: () => Promise<T>): Promise<T> {
  const m = memo.get(key);
  if (m && Date.now() - m.at < 30_000) return m.v as T;
  const v = await f();
  if (memo.size > 64) memo.clear(); // alerts windows are many
  memo.set(key, { at: Date.now(), v });
  return v;
}

type Page<T> = { items: T[]; next: number | null };
const page = <T>(items: T[], limit: number, id: (t: T) => number): Page<T> =>
  ({ items, next: items.length === limit ? id(items[items.length - 1]) : null });
// rankings page by offset: next is the index of the next row
const slice = <T>(rows: T[], before: number, limit: number): Page<T> =>
  ({ items: rows.slice(before, before + limit), next: before + limit < rows.length ? before + limit : null });

function feedRoute(sp: URLSearchParams, col: FeedCol | null, val: string): Route {
  const limit = int(sp, "limit", 50, 1, 200), before = int(sp, "before", 0, 0, 1e15);
  return {
    ttl: 5, params: { val, limit, before },
    run: async (db) => page((await feed(db, col, val, before, limit)).map(toEvent), limit, (e) => e.id),
  };
}

// route validates the url into a Route, or returns null for an unknown path. Throws BadInput.
export function route(url: URL): Route | null {
  const sp = url.searchParams;
  let p: string[];
  try {
    p = url.pathname.split("/").slice(1).map(decodeURIComponent);
  } catch {
    throw new BadInput("bad path encoding");
  }
  const at = (...parts: string[]) => p.length === parts.length && parts.every((x, i) => x === "*" || x === p[i]);
  if (at("feed")) {
    const kind = sp.get("kind");
    if (kind !== null && !(kind in FIELDS)) throw new BadInput("unknown kind");
    return feedRoute(sp, kind ? "kind" : null, kind ?? "");
  }
  if (at("pakts", "*", "feed")) return feedRoute(sp, "vault", account(p[1]));
  if (at("accounts", "*", "feed")) return feedRoute(sp, "actor", account(p[1]));
  if (at("pakts")) {
    const limit = int(sp, "limit", 50, 1, 200), before = int(sp, "before", 0, 0, 1e15);
    return { ttl: 30, params: { limit, before }, run: async (db) => page(await pakts(db, "", before, limit), limit, (x) => x.id) };
  }
  if (at("pakts", "*")) {
    const vault = account(p[1]);
    return { ttl: 30, params: {}, run: async (db) => (await pakts(db, vault, 0, 1))[0] ?? null };
  }
  if (at("traders", "*")) {
    const trader = account(p[1]);
    // shortcut: scans copy-kind history in memory, like the leaderboard
    return { ttl: 30, params: {}, run: async (db) => traderRecord(await memoized("copy", () => since(db, COPY_KINDS, 0)), trader) };
  }
  if (at("pakts", "*", "config")) {
    const vault = account(p[1]);
    return { ttl: 30, params: {}, run: async (db) => cloneConfig(await memoized("copy", () => since(db, COPY_KINDS, 0)), vault) };
  }
  if (at("leaderboard")) {
    const range = sp.get("range") ?? "all";
    if (!["7d", "30d", "all"].includes(range)) throw new BadInput("range must be 7d, 30d or all");
    const limit = int(sp, "limit", 50, 1, 200), before = int(sp, "before", 0, 0, 1e6);
    return {
      ttl: 30, params: { range, limit, before },
      run: async (db) => {
        const sinceMs = range === "all" ? 0 : Date.now() - parseInt(range) * UNIT.d;
        // shortcut: ranks all history in memory, move to sql aggregates once rows reach ~1e5
        const { traders, pakts } = await memoized(`lb:${range}`, async () => leaderboard(await since(db, LEADERBOARD_KINDS, 0), sinceMs));
        return { traders: slice(traders, before, limit), pakts: slice(pakts, before, limit) };
      },
    };
  }
  if (at("alerts")) {
    const win = windowMs(sp.get("window"));
    const limit = int(sp, "limit", 50, 1, 200), before = int(sp, "before", 0, 0, 1e6);
    return {
      ttl: 30, params: { window: win, limit, before },
      // every window filters one memoized 30d scan, so cycling window values cannot force a scan each
      run: async (db) => {
        const all = await memoized("al", () => since(db, ["trade"], Date.now() - 30 * UNIT.d));
        return slice(alerts(all.filter((r) => r.ts_ms >= Date.now() - win)), before, limit);
      },
    };
  }
  return null;
}

// cacheKey is the path plus only the validated params, so junk or reordered params share one entry.
export function cacheKey(url: URL, r: Route): string {
  const q = new URLSearchParams(Object.entries(r.params).map(([k, v]) => [k, String(v)]).sort(([a], [b]) => a.localeCompare(b)));
  return `${url.origin}${url.pathname}?${q}`;
}
