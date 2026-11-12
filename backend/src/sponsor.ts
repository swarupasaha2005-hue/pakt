// Gas sponsor (NEP-366 meta txs): POST /relay {delegate: base64 borsh SignedDelegate} wraps a user's signed Pakt call in a
// FAUCET_SIGNER tx, so we pay the gas; attached deposits still come from the user. FREE_TXS per account, ever.
import { account } from "./api";
import { Rpc, trusted, Upstream } from "./chain";
import { signer } from "./faucet";
import { b58decode, b58encode, parseKey, signedTx } from "./relay";

export const FREE_TXS = 2;
const MAX_GAS = 300_000_000_000_000n; // one tx's worth; the relayer pays for all of it up front
const MAX_BYTES = 16_384;
const PREFIX = 2 ** 30 + 366; // NEP-366 SignableMessage discriminant
const FACTORY_METHODS = new Set(["create_pakt"]);
const VAULT_METHODS = new Set([
  "storage_deposit", "leave", "claim", "finish_fire", "dex_recover", "reconcile", "unlock", "sync_member",
  "accept_offer", "decline_offer", "trade", "settle",
]);

export type Fn = { method: string; args: Uint8Array; gas: bigint; deposit: bigint };
export type Delegate = { sender: string; receiver: string; actions: Fn[]; nonce: bigint; maxHeight: bigint; pub: Uint8Array; sig: Uint8Array; body: Uint8Array };
export type Sponsored = { status: number; body: { hash?: string; outcome?: unknown; left?: number; error?: string } };

class Bad extends Error {}

// minimal borsh reader, little endian; throws Bad on short input
class R {
  i = 0;
  constructor(private b: Uint8Array) {}
  take(n: number) {
    if (this.i + n > this.b.length) throw new Bad("truncated");
    return this.b.slice(this.i, (this.i += n));
  }
  uint(n: number) {
    return this.take(n).reduceRight((v, x) => v * 256n + BigInt(x), 0n);
  }
  bytes() {
    return this.take(Number(this.uint(4)));
  }
  str() {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(this.bytes());
  }
}

// decode reads a SignedDelegate whose actions are all FunctionCalls with ed25519 keys; anything else is Bad.
export function decode(raw: Uint8Array): Delegate {
  const r = new R(raw);
  const sender = r.str(), receiver = r.str();
  const n = Number(r.uint(4));
  if (n < 1 || n > 4) throw new Bad("1-4 actions");
  const actions: Fn[] = [];
  for (let k = 0; k < n; k++) {
    if (r.uint(1) !== 2n) throw new Bad("only function calls");
    actions.push({ method: r.str(), args: r.bytes(), gas: r.uint(8), deposit: r.uint(16) });
  }
  const nonce = r.uint(8), maxHeight = r.uint(8);
  if (r.uint(1) !== 0n) throw new Bad("ed25519 keys only");
  const pub = r.take(32);
  const body = raw.slice(0, r.i);
  if (r.uint(1) !== 0n) throw new Bad("ed25519 signature only");
  const sig = r.take(64);
  if (r.i !== raw.length) throw new Bad("trailing bytes");
  return { sender, receiver, actions, nonce, maxHeight, pub, sig, body };
}

const tokensOf = (env: Env) => Object.keys(env.PRICE_MAP ? JSON.parse(env.PRICE_MAP) : {}); // every whitelisted token is priced

// refusal says why a delegate is not a Pakt call we pay for, else null
export function refusal(d: Delegate, env: Env): string | null {
  const f = env.PAKT_FACTORY;
  const isVault = d.receiver !== f && trusted(d.receiver, f);
  const isToken = tokensOf(env).includes(d.receiver);
  if (d.receiver !== f && !isVault && !isToken) return "receiver is not a pakt contract";
  if (d.actions.reduce((g, a) => g + a.gas, 0n) > MAX_GAS) return "too much gas";
  for (const a of d.actions) {
    const ok = d.receiver === f ? FACTORY_METHODS.has(a.method)
      : isVault ? VAULT_METHODS.has(a.method)
      : a.method === "storage_deposit" || (a.method === "ft_transfer_call" && vaultArg(a.args, f));
    if (!ok) return `method ${a.method} not sponsored`;
  }
  return null;
}

// ft_transfer_call only into one of our vaults, never to an arbitrary account
function vaultArg(args: Uint8Array, factory: string): boolean {
  try {
    const to = JSON.parse(new TextDecoder().decode(args))?.receiver_id;
    return typeof to === "string" && to !== factory && trusted(to, factory);
  } catch {
    return false;
  }
}

export async function left(env: Env, who: string): Promise<number> {
  if (!env.FAUCET_SIGNER) return 0;
  const n = await env.DB.prepare("select n from sponsored where account = ?").bind(who).first<number>("n");
  return Math.max(0, FREE_TXS - (n ?? 0));
}

// take counts one sponsored tx atomically: no row back means the account is at the cap
const take = (env: Env, who: string) =>
  env.DB.prepare("insert into sponsored (account, n) values (?1, 1) on conflict (account) do update set n = n + 1 where n < ?2 returning n")
    .bind(who, FREE_TXS).first<number>("n");
const refund = (env: Env, who: string) => env.DB.prepare("update sponsored set n = n - 1 where account = ? and n > 0").bind(who).run();

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sponsor(env: Env, body: string): Promise<Sponsored> {
  if (!env.FAUCET_SIGNER) return { status: 404, body: { error: "sponsor off" } };
  let d: Delegate, raw: Uint8Array;
  try {
    if (body.length > MAX_BYTES) throw new Bad("too large");
    d = decode((raw = unb64(JSON.parse(body)?.delegate)));
    account(d.sender);
  } catch {
    return { status: 400, body: { error: "bad payload: want {delegate: base64 borsh SignedDelegate}" } };
  }
  const no = refusal(d, env);
  if (no) return { status: 403, body: { error: no } };
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from([PREFIX & 255, (PREFIX >> 8) & 255, (PREFIX >> 16) & 255, PREFIX >>> 24, ...d.body]));
  const pk = await crypto.subtle.importKey("raw", d.pub, { name: "Ed25519" }, false, ["verify"]).catch(() => null);
  // a forged delegate would burn someone else's free txs, so check it before counting
  if (!pk || !(await crypto.subtle.verify("Ed25519", pk, d.sig, digest))) return { status: 400, body: { error: "bad signature" } };
  if (!(await left(env, d.sender))) return { status: 429, body: { error: "no free transactions left" } };

  const up = new Upstream(6);
  const rpc = new Rpc(env.TESTNET_RPC_URL, env.FASTNEAR_API_KEY);
  const userKey = await rpc.call<{ nonce: number; block_height: number; permission: unknown }>(up, "query", {
    request_type: "view_access_key", finality: "final", account_id: d.sender, public_key: `ed25519:${b58encode(d.pub)}`,
  }).catch(() => null);
  if (userKey?.permission !== "FullAccess") return { status: 403, body: { error: "not a full access key of the sender" } };
  if (d.maxHeight <= BigInt(userKey.block_height)) return { status: 400, body: { error: "delegate expired" } };
  if (d.nonce <= BigInt(userKey.nonce)) return { status: 400, body: { error: "delegate nonce already used" } };

  for (let i = 0; signer.busy && i < 50; i++) await sleep(100); // a multi-tx flow posts back to back
  if (signer.busy) return { status: 429, body: { error: "busy, retry in a few seconds" } };
  signer.busy = true;
  let landed = false;
  try {
    if (!(await take(env, d.sender))) return { status: 429, body: { error: "no free transactions left" } };
    const key = await parseKey(env.FAUCET_SIGNER);
    const ak = await rpc.call<{ nonce: number; block_hash: string }>(up, "query", {
      request_type: "view_access_key", finality: "final", account_id: key.account, public_key: `ed25519:${b58encode(key.pub)}`,
    });
    if (!Number.isInteger(ak?.nonce)) throw new Error(`no access key on ${key.account}`);
    const tx = await signedTx(key, BigInt(ak!.nonce) + 1n, d.sender, b58decode(ak!.block_hash), [{ delegate: raw }]);
    const out = await rpc.call<{ transaction: { hash: string } }>(up, "send_tx", { signed_tx_base64: b64(tx), wait_until: "EXECUTED_OPTIMISTIC" }).catch((e) => {
      landed = !/INVALID_TRANSACTION/.test(String(e)); // a timeout may still land; only a rejected tx surely did not
      throw e;
    });
    landed = true;
    return { status: 200, body: { hash: out!.transaction.hash, outcome: out, left: await left(env, d.sender) } };
  } catch (e) {
    if (!landed) await refund(env, d.sender);
    throw e;
  } finally {
    signer.busy = false;
  }
}

// Fallback for wallets that can't sign delegate actions: send a new, empty account enough NEAR for its free txs' gas.
export const TOPUP = 50_000_000_000_000_000_000_000n; // 0.05 NEAR covers 2 txs at 300 TGas prepaid
const TOPUP_PER_IP_DAY = 3;

export async function topup(env: Env, who: string, ip: string): Promise<Sponsored> {
  if (!env.FAUCET_SIGNER) return { status: 404, body: { error: "sponsor off" } };
  if (!(await left(env, who))) return { status: 429, body: { error: "no free transactions left" } };
  const up = new Upstream(4);
  const rpc = new Rpc(env.TESTNET_RPC_URL, env.FASTNEAR_API_KEY);
  const acc = await rpc.call<{ amount: string; locked: string }>(up, "query", { request_type: "view_account", finality: "final", account_id: who }).catch(() => null);
  if (!acc?.amount) return { status: 400, body: { error: "account not found" } };
  // funded accounts pay their own gas; the top-up is only for accounts that couldn't send a tx at all
  if (BigInt(acc.amount) >= TOPUP) return { status: 200, body: { left: await left(env, who), error: "has gas" } };
  const since = Date.now() - 86_400_000;
  const byIp = await env.DB.prepare("select count(*) n from gas_topups where ip = ? and at > ?").bind(ip, since).first<number>("n");
  if ((byIp ?? 0) >= TOPUP_PER_IP_DAY) return { status: 429, body: { error: "daily limit reached on this network" } };
  if (signer.busy) return { status: 429, body: { error: "busy, retry in a few seconds" } };
  signer.busy = true;
  try {
    // claim first: the primary key makes a second top-up for the same account fail here, before any NEAR moves
    const ok = await env.DB.prepare("insert into gas_topups (account, ip, at) values (?, ?, ?) on conflict do nothing returning account").bind(who, ip, Date.now()).first<string>("account");
    if (!ok) return { status: 429, body: { error: "already topped up" } };
    let landed = false;
    try {
      const key = await parseKey(env.FAUCET_SIGNER);
      const ak = await rpc.call<{ nonce: number; block_hash: string }>(up, "query", {
        request_type: "view_access_key", finality: "final", account_id: key.account, public_key: `ed25519:${b58encode(key.pub)}`,
      });
      if (!Number.isInteger(ak?.nonce)) throw new Error(`no access key on ${key.account}`);
      const tx = await signedTx(key, BigInt(ak!.nonce) + 1n, who, b58decode(ak!.block_hash), [{ transfer: TOPUP }]);
      const out = await rpc.call<{ transaction: { hash: string } }>(up, "send_tx", { signed_tx_base64: b64(tx), wait_until: "EXECUTED_OPTIMISTIC" }).catch((e) => {
        landed = !/INVALID_TRANSACTION/.test(String(e));
        throw e;
      });
      landed = true;
      // the gas money stands in for both free txs
      await env.DB.prepare("insert into sponsored (account, n) values (?1, ?2) on conflict (account) do update set n = ?2").bind(who, FREE_TXS).run();
      return { status: 200, body: { hash: out!.transaction.hash, left: 0 } };
    } catch (e) {
      if (!landed) await env.DB.prepare("delete from gas_topups where account = ?").bind(who).run();
      throw e;
    }
  } finally {
    signer.busy = false;
  }
}
