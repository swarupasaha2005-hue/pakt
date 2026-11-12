// Testnet faucet: POST /faucet?account=<id> sends each FAUCET_DRIPS token from a pre-funded faucet account.
// Off unless FAUCET_SIGNER (`account_id:ed25519:<secret>` of that faucet account, never the token owner) and FAUCET_DRIPS are set.
import { Rpc, Upstream } from "./chain";
import { b58decode, b58encode, parseKey, signedTx } from "./relay";

declare global {
  interface Env {
    FAUCET_SIGNER?: string;
    FAUCET_DRIPS?: string; // {"<token>": "<raw amount>"}
  }
}

const ACCOUNT = /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const STORAGE = 1_250_000_000_000_000_000_000n; // 0.00125 NEAR, the NEP-145 FT registration cost
// shortcut: one FAUCET_SIGNER tx per isolate so nonces don't race (faucet and gas sponsor); queue it if traffic grows
export const signer = { busy: false, nonce: 0n };
/** next FAUCET_SIGNER nonce: the chain view can lag our own last send by a block or two */
export const nextNonce = (chain: number) => (signer.nonce = (BigInt(chain) > signer.nonce ? BigInt(chain) : signer.nonce) + 1n);

export type Drip = { status: number; body: { sent?: string[]; error?: string } };

const DAY_MS = 86_400_000;
const PER_IP_DAY = 3; // a shared wifi gets a few claims, not unlimited

export async function faucet(env: Env, account: string | null, ip: string): Promise<Drip> {
  if (!env.FAUCET_SIGNER || !env.FAUCET_DRIPS) return { status: 404, body: { error: "faucet off" } };
  if (!account || !ACCOUNT.test(account)) return { status: 400, body: { error: "bad account" } };
  if (signer.busy) return { status: 429, body: { error: "busy, retry in a few seconds" } };
  signer.busy = true;
  try {
    const since = Date.now() - DAY_MS;
    const n = (sql: string, v: string) => env.DB.prepare(sql).bind(v, since).first<number>("n");
    if (await n("select count(*) n from faucet_claims where account = ? and at > ?", account)) return { status: 429, body: { error: "one claim per account per day" } };
    if (((await n("select count(*) n from faucet_claims where ip = ? and at > ?", ip)) ?? 0) >= PER_IP_DAY) return { status: 429, body: { error: "daily limit reached on this network" } };
    const drips = Object.entries(JSON.parse(env.FAUCET_DRIPS) as Record<string, string>);
    const key = await parseKey(env.FAUCET_SIGNER);
    const up = new Upstream(4 + 2 * drips.length);
    const rpc = new Rpc(env.TESTNET_RPC_URL, env.FASTNEAR_API_KEY);
    const exists = await rpc.call<{ amount?: string }>(up, "query", { request_type: "view_account", finality: "final", account_id: account }).catch(() => null);
    if (!exists?.amount) return { status: 400, body: { error: "account not found on testnet" } };
    const ak = await rpc.call<{ nonce: number; block_hash: string }>(up, "query", {
      request_type: "view_access_key", finality: "final", account_id: key.account, public_key: `ed25519:${b58encode(key.pub)}`,
    });
    if (!Number.isInteger(ak?.nonce)) throw new Error(`no access key on ${key.account}`); // wrong FAUCET_SIGNER
    const sent: string[] = [];
    for (const [token, amount] of drips) {
      // registers the receiver (storage refunded if already registered), then transfers
      const tx = await signedTx(key, nextNonce(ak!.nonce), token, b58decode(ak!.block_hash), [
        { method: "storage_deposit", args: { account_id: account, registration_only: true }, deposit: STORAGE },
        { method: "ft_transfer", args: { receiver_id: account, amount, memo: "pakt faucet" }, deposit: 1n },
      ]);
      const out = await rpc.call<{ status: Record<string, unknown> }>(up, "send_tx", { signed_tx_base64: b64(tx), wait_until: "EXECUTED_OPTIMISTIC" });
      if (!out || "Failure" in out.status) throw new Error(`send ${token} failed: ${JSON.stringify(out?.status).slice(0, 300)}`);
      sent.push(token);
    }
    await env.DB.prepare("insert into faucet_claims (account, ip, at) values (?, ?, ?)").bind(account, ip, Date.now()).run();
    return { status: 200, body: { sent } };
  } finally {
    signer.busy = false;
  }
}
