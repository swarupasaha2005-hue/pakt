// Price relay: keyless Coinbase, else Pyth Hermes (when HERMES_API_KEY is set), else keyless CoinGecko -> report_prices on our testnet oracle, once a minute.
// No-op unless PRICE_MAP, PRICE_ORACLE and the ORACLE_REPORTER secret are all set.
import { Rpc, Upstream } from "./chain";

declare global {
  interface Env {
    // optional secrets, so not in wrangler secrets.required
    FASTNEAR_API_KEY?: string;
    ORACLE_REPORTER?: string;
    HERMES_API_KEY?: string;
  }
}

type Price = { multiplier: string; decimals: number };
export type Feed = { id: string; price: { price: string; conf: string; expo: number; publish_time: number } };
export type Ids = { pyth: string; coingecko: string; coinbase?: string }; // coinbase: pair, e.g. NEAR-USD
export type Quote = { price: bigint; expo: number }; // usd per whole token = price * 10^expo

const GAS = 30_000_000_000_000n;
const PYTH_MAX_AGE_S = 60;
const CG_MAX_AGE_S = 300; // coingecko refreshes every 1-5 min and has no confidence band
const MAX_CONF_BPS = 200n;
const enc = new TextEncoder();
const UA = { "user-agent": "pakt-relay/1.0" }; // coingecko 403s requests without one
const feedId = (id: string) => id.replace(/^0x/, "").toLowerCase();

// toOracle: usd per whole token = price * 10^expo -> oracle usd = raw * multiplier / 10^decimals, as vault usd_e6.
export function toOracle(price: bigint, expo: number, tokenDecimals: number): Price {
  const d = tokenDecimals - expo;
  return d >= 0 ? { multiplier: String(price), decimals: d } : { multiplier: String(price * 10n ** BigInt(-d)), decimals: 0 };
}

// decimal reads a number's printed digits exactly: "0.9994" -> 9994e-4, "1e-7" -> 1e-7; null on junk.
export function decimal(s: string): Quote | null {
  const m = /^(\d{1,30})(?:\.(\d{1,30}))?(?:e([+-]?\d{1,2}))?$/i.exec(s);
  if (!m) return null;
  const frac = m[2] ?? "";
  return { price: BigInt(m[1] + frac), expo: Number(m[3] ?? 0) - frac.length };
}

// fresh, tight pyth quotes by feed id
export function fromPyth(feeds: Feed[], nowS: number): Map<string, Quote> {
  const out = new Map<string, Quote>();
  for (const { id, price: p } of feeds) {
    if (!/^\d{1,30}$/.test(p?.price) || !/^\d{1,30}$/.test(p.conf) || !Number.isInteger(p.expo)) continue;
    const [px, conf] = [BigInt(p.price), BigInt(p.conf)];
    if (conf * 10_000n <= px * MAX_CONF_BPS && nowS - p.publish_time <= PYTH_MAX_AGE_S) out.set(feedId(id), { price: px, expo: p.expo });
  }
  return out;
}

// fresh coingecko quotes by coin id; the json number's shortest form is the exact decimal sent
export function fromCoingecko(body: Record<string, { usd?: unknown; last_updated_at?: number }>, nowS: number): Map<string, Quote> {
  const out = new Map<string, Quote>();
  for (const [id, v] of Object.entries(body ?? {})) {
    const q = typeof v?.usd === "number" ? decimal(String(v.usd)) : null;
    if (q && nowS - Number(v.last_updated_at) <= CG_MAX_AGE_S) out.set(id, q);
  }
  return out;
}

// mapPrices names quotes by testnet token. Null when any is missing, zero or odd: never report a half-read.
export function mapPrices(map: Record<string, Ids>, src: keyof Ids, quotes: Map<string, Quote>, decimals: Record<string, number>): { asset_id: string; price: Price }[] | null {
  const out = [];
  for (const [asset_id, ids] of Object.entries(map)) {
    const q = quotes.get(src === "pyth" ? feedId(String(ids?.pyth)) : String(ids?.[src]));
    if (!q || q.price <= 0n || Math.abs(q.expo) > 30) return null;
    out.push({ asset_id, price: toOracle(q.price, q.expo, decimals[asset_id]) });
  }
  return out;
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function b58decode(s: string): Uint8Array {
  let n = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) throw new Error("bad base58");
    n = n * 58n + BigInt(i);
  }
  const out: number[] = [];
  for (; n > 0n; n /= 256n) out.unshift(Number(n % 256n));
  for (let i = 0; s[i] === "1"; i++) out.unshift(0);
  return Uint8Array.from(out);
}

export function b58encode(b: Uint8Array): string {
  let n = b.reduce((a, x) => a * 256n + BigInt(x), 0n);
  let s = "";
  for (; n > 0n; n /= 58n) s = B58[Number(n % 58n)] + s;
  for (let i = 0; b[i] === 0; i++) s = "1" + s;
  return s;
}

const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// minimal borsh, little endian
class W {
  b: number[] = [];
  uint(n: bigint, bytes: number) {
    for (let i = 0; i < bytes; i++, n >>= 8n) this.b.push(Number(n & 255n));
  }
  raw(a: Uint8Array) {
    this.b.push(...a);
  }
  bytes(a: Uint8Array) {
    this.uint(BigInt(a.length), 4);
    this.raw(a);
  }
  str(s: string) {
    this.bytes(enc.encode(s));
  }
}

export type Key = { account: string; pub: Uint8Array; sign: (msg: Uint8Array) => Promise<Uint8Array> };

// parseKey reads `account_id:ed25519:<base58 seed||pub>`. Errors never echo the secret.
export async function parseKey(s: string): Promise<Key> {
  const m = /^([a-z\d._-]{2,64}):ed25519:([1-9A-HJ-NP-Za-km-z]+)$/.exec(s);
  const raw = m ? b58decode(m[2]) : null;
  if (!m || raw!.length !== 64) throw new Error("ORACLE_REPORTER must be account_id:ed25519:<64-byte base58 secret>");
  const pub = raw!.slice(32);
  const jwk = { kty: "OKP", crv: "Ed25519", d: b64url(raw!.slice(0, 32)), x: b64url(pub) };
  const k = await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["sign"]);
  return { account: m[1], pub, sign: async (msg) => new Uint8Array(await crypto.subtle.sign("Ed25519", k, msg)) };
}

// signedTx is borsh SignedTransaction (Transaction v0) with one FunctionCall; signature is over sha256(tx).
export type Call = { method: string; args: object; deposit?: bigint } | { delegate: Uint8Array } | { transfer: bigint }; // yocto; delegate: borsh SignedDelegate

export async function signedTx(key: Key, nonce: bigint, receiver: string, blockHash: Uint8Array, calls: Call[]): Promise<Uint8Array> {
  const w = new W();
  w.str(key.account);
  w.uint(0n, 1); // ed25519
  w.raw(key.pub);
  w.uint(nonce, 8);
  w.str(receiver);
  w.raw(blockHash);
  w.uint(BigInt(calls.length), 4);
  for (const c of calls) {
    if ("delegate" in c) {
      w.uint(8n, 1); // Delegate (NEP-366)
      w.raw(c.delegate);
      continue;
    }
    if ("transfer" in c) {
      w.uint(3n, 1); // Transfer
      w.uint(c.transfer, 16);
      continue;
    }
    w.uint(2n, 1); // FunctionCall
    w.str(c.method);
    w.bytes(enc.encode(JSON.stringify(c.args)));
    w.uint(GAS, 8);
    w.uint(c.deposit ?? 0n, 16);
  }
  const tx = Uint8Array.from(w.b);
  const sig = await key.sign(new Uint8Array(await crypto.subtle.digest("SHA-256", tx)));
  return Uint8Array.from([...tx, 0, ...sig]);
}

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

let busy = false; // one report in flight per isolate; a racing one dies on its nonce anyway
const decimalsOf = new Map<string, number>(); // ft decimals never change

const MAX_JUMP = 0.2;
const JUMP_ROUNDS = 3;
const last = new Map<string, number>(); // asset -> last reported usd per raw unit
const strikes = new Map<string, number>();

// steady holds a >20% move until it repeats 3 rounds, so one bad source tick can't misprice vaults.
// shortcut: per-isolate memory, a fresh isolate trusts its first round; persist in DO storage if that matters.
export const resetSteady = () => (last.clear(), strikes.clear()); // tests

export function steady(prices: { asset_id: string; price: Price }[]): boolean {
  let ok = true;
  for (const { asset_id, price } of prices) {
    const v = Number(price.multiplier) / 10 ** price.decimals;
    const prev = last.get(asset_id);
    if (prev !== undefined && Math.abs(v / prev - 1) > MAX_JUMP && (strikes.get(asset_id) ?? 0) + 1 < JUMP_ROUNDS) {
      strikes.set(asset_id, (strikes.get(asset_id) ?? 0) + 1);
      ok = false;
    }
  }
  if (ok) for (const { asset_id, price } of prices) last.set(asset_id, Number(price.multiplier) / 10 ** price.decimals), strikes.delete(asset_id);
  return ok;
}


// relay runs one round. Returns what it did, for logs and tests; never the key.
export async function relay(env: Env): Promise<string> {
  if (!env.PRICE_MAP || !env.PRICE_ORACLE || !env.ORACLE_REPORTER) return "off";
  if (busy) return "busy";
  busy = true;
  try {
    const map = JSON.parse(env.PRICE_MAP) as Record<string, Ids>;
    const key = await parseKey(env.ORACLE_REPORTER);
    const up = new Upstream(5 + 2 * Object.keys(map).length);
    const testnet = new Rpc(env.TESTNET_RPC_URL, env.FASTNEAR_API_KEY);
    for (const t of Object.keys(map)) {
      if (decimalsOf.has(t)) continue;
      const v = await testnet.call<{ result: number[] }>(up, "query", {
        request_type: "call_function", finality: "final", account_id: t, method_name: "ft_metadata", args_base64: "",
      });
      const d = JSON.parse(new TextDecoder().decode(Uint8Array.from(v!.result))).decimals;
      if (!Number.isInteger(d) || d < 0 || d > 30) throw new Error(`${t}: bad ft decimals`);
      decimalsOf.set(t, d);
    }
    // pyth when keyed, else (or when pyth is down/stale) coingecko; one call per source covers every token
    const now = Date.now() / 1000;
    const read = async (src: keyof Ids) => {
      const ids = [...new Set(Object.values(map).map((i) => encodeURIComponent(String(i?.[src]))))];
      // coinbase: live spot, no timestamp or band; one call per pair
      const quotes = src === "coinbase"
        ? new Map(await Promise.all(ids.map(async (i) => [decodeURIComponent(i), decimal(String(((await up.json(`${env.COINBASE_URL}/v2/prices/${i}/spot`, { headers: UA })) as { data?: { amount?: unknown } }).data?.amount))] as const)).then((e) => e.filter((x): x is [string, Quote] => !!x[1])))
        : src === "pyth"
        ? fromPyth(((await up.json(`${env.HERMES_URL}/v2/updates/price/latest?${ids.map((i) => `ids%5B%5D=${i}`).join("&")}&parsed=true`, {
          headers: { ...UA, authorization: `Bearer ${env.HERMES_API_KEY}` },
        })) as { parsed?: Feed[] }).parsed ?? [], now)
        : fromCoingecko((await up.json(`${env.COINGECKO_URL}/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_last_updated_at=true&precision=full`, { headers: UA })) as Parameters<typeof fromCoingecko>[0], now);
      return mapPrices(map, src, quotes, Object.fromEntries(decimalsOf));
    };
    // coinbase first: free and reliable from workers; coingecko last, it 429s cloudflare's shared ips
    let prices = Object.values(map).every((i) => i?.coinbase) ? await read("coinbase").catch((e) => (console.warn(JSON.stringify({ msg: "coinbase failed", err: String(e) })), null)) : null;
    if (!prices && env.HERMES_API_KEY) prices = await read("pyth").catch((e) => (console.warn(JSON.stringify({ msg: "pyth failed", err: String(e) })), null));
    prices ??= await read("coingecko");
    if (!prices) return "stale";
    if (!steady(prices)) return "jump held";
    const ak = await testnet.call<{ nonce: number; block_hash: string }>(up, "query", {
      request_type: "view_access_key", finality: "final", account_id: key.account, public_key: `ed25519:${b58encode(key.pub)}`,
    });
    if (!Number.isInteger(ak?.nonce)) throw new Error(`no access key ${b58encode(key.pub).slice(0, 8)}… on ${key.account}`); // wrong ORACLE_REPORTER
    const tx = await signedTx(key, BigInt(ak!.nonce) + 1n, env.PRICE_ORACLE, b58decode(ak!.block_hash), [{ method: "report_prices", args: { prices } }]);
    const out = await testnet.call<{ status: Record<string, unknown> }>(up, "send_tx", { signed_tx_base64: b64(tx), wait_until: "EXECUTED_OPTIMISTIC" });
    if (!out || "Failure" in out.status) throw new Error(`report_prices failed: ${JSON.stringify(out?.status).slice(0, 300)}`);
    return `reported ${prices.length}`;
  } finally {
    busy = false;
  }
}
