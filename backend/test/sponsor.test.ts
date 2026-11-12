import { env as testEnv } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { b58encode } from "../src/relay";
import { left, sponsor, topup, TOPUP } from "../src/sponsor";

afterEach(() => vi.restoreAllMocks());

const enc = new TextEncoder();
const fromUrl = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const le = (n: bigint, bytes: number) => Array.from({ length: bytes }, (_, i) => Number((n >> BigInt(8 * i)) & 255n));
const str = (s: string) => [...le(BigInt(enc.encode(s).length), 4), ...enc.encode(s)];

async function keypair() {
  const kp = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", kp.privateKey)) as JsonWebKey;
  return { kp, pub: fromUrl(jwk.x!), secret: b58encode(Uint8Array.from([...fromUrl(jwk.d!), ...fromUrl(jwk.x!)])) };
}

type Act = { method: string; args: object; deposit?: bigint } | { transfer: bigint };
// borsh SignedDelegate, signed over sha256(u32 2^30+366 || DelegateAction) as NEP-366 says
async function delegate(sender: string, receiver: string, acts: Act[], o: { maxHeight?: bigint; forge?: boolean } = {}) {
  const k = await keypair();
  const body = [...str(sender), ...str(receiver), ...le(BigInt(acts.length), 4)];
  for (const a of acts) {
    if ("transfer" in a) body.push(3, ...le(a.transfer, 16));
    else body.push(2, ...str(a.method), ...str(JSON.stringify(a.args)), ...le(30_000_000_000_000n, 8), ...le(a.deposit ?? 0n, 16));
  }
  body.push(...le(6n, 8), ...le(o.maxHeight ?? 1000n, 8), 0, ...k.pub);
  const msg = Uint8Array.from([...le(2n ** 30n + 366n, 4), ...body]);
  const sig = new Uint8Array(await crypto.subtle.sign("Ed25519", k.kp.privateKey, await crypto.subtle.digest("SHA-256", msg)));
  if (o.forge) sig[0] ^= 1;
  const raw = Uint8Array.from([...body, 0, ...sig]);
  return { raw, payload: JSON.stringify({ delegate: btoa(String.fromCharCode(...raw)) }) };
}

const TOKEN = "tusdc.owner.testnet";
let faucetSecret = "";
async function env(over: Partial<Env> = {}) {
  faucetSecret ||= (await keypair()).secret;
  return { ...testEnv, FAUCET_SIGNER: `faucet.testnet:ed25519:${faucetSecret}`, PRICE_MAP: JSON.stringify({ [TOKEN]: {} }), ...over } as Env;
}

// fake rpc: the user's full access key at height 100, the faucet key, then send_tx
function rpc(send: () => Response = () => Response.json({ jsonrpc: "2.0", id: "pakt", result: { transaction: { hash: "TxHash" }, status: { SuccessValue: "" } } })) {
  const sent: Uint8Array[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    const { method, params } = JSON.parse(String(init?.body));
    if (method === "send_tx") {
      sent.push(Uint8Array.from(atob(params.signed_tx_base64), (c) => c.charCodeAt(0)));
      return send();
    }
    const result = { nonce: 5, block_height: 100, block_hash: b58encode(new Uint8Array(32).fill(7)), permission: "FullAccess" };
    return Response.json({ jsonrpc: "2.0", id: "pakt", result });
  });
  return sent;
}

const deposit = (vault = "fam.pakt.testnet") => [{ method: "ft_transfer_call", args: { receiver_id: vault, amount: "1", msg: "" }, deposit: 1n }];

describe("sponsor", () => {
  it("is off without the faucet signer", async () => {
    expect((await sponsor(await env({ FAUCET_SIGNER: undefined }), "{}")).status).toBe(404);
    expect(await left(await env({ FAUCET_SIGNER: undefined }), "bob.testnet")).toBe(0);
  });

  it("rejects bad payloads before any rpc", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    const ok = await delegate("bob.testnet", TOKEN, deposit());
    const truncated = JSON.stringify({ delegate: btoa(String.fromCharCode(...ok.raw.slice(0, -1))) });
    const transfer = (await delegate("bob.testnet", TOKEN, [{ transfer: 5n }])).payload;
    for (const p of ["", "nope", '{"delegate":"!!"}', '{"delegate":"AAAA"}', truncated, transfer]) expect((await sponsor(await env(), p)).status).toBe(400);
    expect((await sponsor(await env(), (await delegate("bob.testnet", TOKEN, deposit(), { forge: true })).payload)).body.error).toBe("bad signature");
    expect(f).not.toHaveBeenCalled();
  });

  it.each([
    ["an outside receiver", "evil.testnet", deposit()],
    ["a lookalike factory", "evilpakt.testnet", [{ method: "create_pakt", args: {} }]],
    ["a nested vault", "x.fam.pakt.testnet", [{ method: "leave", args: {} }]],
    ["a non pakt method", "fam.pakt.testnet", [{ method: "add_proposal", args: {} }]],
    ["a token transfer", TOKEN, [{ method: "ft_transfer", args: { receiver_id: "bob.testnet", amount: "1" }, deposit: 1n }]],
    ["ft_transfer_call to an outside account", TOKEN, deposit("evil.testnet")],
    ["ft_transfer_call to the factory", TOKEN, deposit("pakt.testnet")],
  ])("refuses %s before any rpc", async (_, receiver, acts) => {
    const f = vi.spyOn(globalThis, "fetch");
    expect((await sponsor(await env(), (await delegate("bob.testnet", receiver, acts)).payload)).status).toBe(403);
    expect(f).not.toHaveBeenCalled();
  });

  it("rejects an expired delegate", async () => {
    rpc();
    const r = await sponsor(await env(), (await delegate("late.testnet", "pakt.testnet", [{ method: "create_pakt", args: {} }], { maxHeight: 100n })).payload);
    expect(r).toEqual({ status: 400, body: { error: "delegate expired" } });
    expect(await left(await env(), "late.testnet")).toBe(2);
  });

  it("pays for two txs per account, wrapping the signed delegate as is", async () => {
    const sent = rpc();
    const e = await env();
    const first = await delegate("carol.testnet", TOKEN, deposit());
    expect(await sponsor(e, first.payload)).toMatchObject({ status: 200, body: { hash: "TxHash", left: 1 } });
    // Delegate action tag then the SignedDelegate bytes, ahead of the faucet's signature
    expect(sent[0].slice(-65 - first.raw.length - 1, -65)).toEqual(Uint8Array.from([8, ...first.raw]));
    expect(await sponsor(e, (await delegate("carol.testnet", "fam.pakt.testnet", [{ method: "leave", args: { shares: "1" } }])).payload)).toMatchObject({ status: 200, body: { left: 0 } });
    expect(await sponsor(e, (await delegate("carol.testnet", "pakt.testnet", [{ method: "create_pakt", args: {} }])).payload)).toEqual({ status: 429, body: { error: "no free transactions left" } });
    expect(sent).toHaveLength(2);
    expect(await left(e, "dave.testnet")).toBe(2);
  });

  it("refunds the count when the chain rejects the tx", async () => {
    rpc(() => Response.json({ jsonrpc: "2.0", id: "pakt", error: { cause: { name: "INVALID_TRANSACTION" }, message: "nonce" } }));
    const e = await env();
    await expect(sponsor(e, (await delegate("erin.testnet", TOKEN, deposit())).payload)).rejects.toThrow(/INVALID_TRANSACTION/);
    expect(await left(e, "erin.testnet")).toBe(2);
  });
});

// view_account answers with this balance; everything else as rpc() does
function rpcWithBalance(amount: bigint) {
  const sent: Uint8Array[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    const { method, params } = JSON.parse(String(init?.body));
    if (method === "send_tx") {
      sent.push(Uint8Array.from(atob(params.signed_tx_base64), (c) => c.charCodeAt(0)));
      return Response.json({ jsonrpc: "2.0", id: "pakt", result: { transaction: { hash: "TopupHash" }, status: { SuccessValue: "" } } });
    }
    if (params.request_type === "view_account") return Response.json({ jsonrpc: "2.0", id: "pakt", result: { amount: String(amount), locked: "0" } });
    return Response.json({ jsonrpc: "2.0", id: "pakt", result: { nonce: 5, block_height: 100, block_hash: b58encode(new Uint8Array(32).fill(7)) } });
  });
  return sent;
}

describe("gas topup", () => {
  it("skips accounts that already have gas money", async () => {
    const sent = rpcWithBalance(TOPUP);
    const r = await topup(await env(), "rich.testnet", "ip1");
    expect(r.body.error).toBe("has gas");
    expect(sent).toHaveLength(0);
    expect(await left(await env(), "rich.testnet")).toBe(2);
  });

  it("sends one transfer to an empty account, then uses up its free txs", async () => {
    const sent = rpcWithBalance(0n);
    const e = await env();
    const r = await topup(e, "empty.testnet", "ip2");
    expect(r.status).toBe(200);
    expect(sent).toHaveLength(1);
    // Transfer action (tag 3) carrying exactly TOPUP
    const tail = sent[0].slice(-(64 + 1 + 17));
    expect(tail[0]).toBe(3);
    expect(tail.slice(1, 17)).toEqual(Uint8Array.from(Array.from({ length: 16 }, (_, i) => Number((TOPUP >> BigInt(8 * i)) & 255n))));
    expect(await left(e, "empty.testnet")).toBe(0);
    expect((await topup(e, "empty.testnet", "ip2")).status).toBe(429);
    expect(sent).toHaveLength(1);
  });

  it("caps top-ups per ip per day", async () => {
    rpcWithBalance(0n);
    const e = await env();
    for (const a of ["a1.testnet", "a2.testnet", "a3.testnet"]) expect((await topup(e, a, "ip3")).status).toBe(200);
    expect((await topup(e, "a4.testnet", "ip3")).body.error).toBe("daily limit reached on this network");
  });
});
