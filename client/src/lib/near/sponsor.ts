// Gas sponsor (NEP-366): the wallet signs delegate actions, the backend relays them and pays the gas. Deposits stay the user's.
import { PublicKey } from "@near-js/crypto";
import { buildDelegateAction, encodeSignedDelegate, type SignedDelegate } from "@near-js/transactions";
import type { FinalExecutionOutcome, Wallet } from "@near-wallet-selector/core";
import { API_URL, FACTORY, RPC_URL, token } from "../config";
import type { Tx } from "./contracts";

/** free sponsored txs left; 0 when the sponsor is off or unreachable */
export async function freeTxs(account: string): Promise<number> {
  const r = await fetch(`${API_URL}/relay/left?account=${encodeURIComponent(account)}`).catch(() => null);
  return r?.ok ? Number((await r.json()).left) || 0 : 0;
}

/** the receivers the backend pays for: factory, a direct vault under it, a whitelisted token */
const ours = (id: string) => id === FACTORY || (id.endsWith(`.${FACTORY}`) && !id.slice(0, -FACTORY.length - 1).includes(".")) || !!token(id);
/** all or nothing: a flow is sponsored only if every tx of it fits the free count */
export const sponsorable = (txs: Tx[], left: number) => txs.length > 0 && txs.length <= left && txs.every((t) => ours(t.receiverId));

/** nothing was sent; walletCant: the wallet module has no delegate signing at all */
export class NoDelegates extends Error {
  walletCant = false;
}

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

/**
 * signs every tx as a delegate action, then relays them in order, each awaited like a wallet send.
 * Throws NoDelegates only when nothing was sent, so the caller can fall back to a normal send.
 */
export async function sendSponsored(w: Wallet, accountId: string, publicKey: string, txs: Tx[]): Promise<FinalExecutionOutcome[]> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "pakt", method: "query", params: { request_type: "view_access_key", finality: "final", account_id: accountId, public_key: publicKey } }),
  });
  const ak = (await res.json()).result as { nonce: number; block_height: number } | undefined;
  if (!ak) throw new NoDelegates("access key not found");
  // 10.1.4 types leave signDelegateAction out; every wallet module has it, most throw "not supported"
  const sign = (w as unknown as { signDelegateAction: (d: unknown) => Promise<SignedDelegate | [Uint8Array, SignedDelegate]> }).signDelegateAction;
  const signed: SignedDelegate[] = [];
  for (const [i, t] of txs.entries()) {
    const d = buildDelegateAction({
      senderId: accountId, receiverId: t.receiverId, actions: t.actions, publicKey: PublicKey.fromString(publicKey),
      nonce: BigInt(ak.nonce) + BigInt(i + 1), maxBlockHeight: BigInt(ak.block_height + 600),
    });
    try {
      const r = await sign(d);
      signed.push(Array.isArray(r) ? r[1] : r);
    } catch (e) {
      if (/not supported/i.test(String(e))) throw Object.assign(new NoDelegates(String(e)), { walletCant: true });
      throw e;
    }
  }
  const outs: FinalExecutionOutcome[] = [];
  for (const sd of signed) {
    const r = await fetch(`${API_URL}/relay`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ delegate: b64(encodeSignedDelegate(sd)) }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = body.error ?? `relay: ${r.status}`;
      // only a 4xx surely sent nothing; a 5xx may have landed, and a fallback could then run it twice
      if (!outs.length && r.status < 500) throw new NoDelegates(msg);
      throw new Error(`${msg} (${outs.length} of ${signed.length} sent)`);
    }
    outs.push(body.outcome as FinalExecutionOutcome);
  }
  return outs;
}

/** fallback when the wallet can't sign delegates: the backend sends an empty account its gas money once. true = it did */
export async function topup(account: string): Promise<boolean> {
  const r = await fetch(`${API_URL}/relay/topup?account=${encodeURIComponent(account)}`, { method: "POST" }).catch(() => null);
  return !!r?.ok && !!(await r.json().catch(() => ({}))).hash;
}
