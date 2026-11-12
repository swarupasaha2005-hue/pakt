import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { b58decode, b58encode, decimal, fromCoingecko, fromPyth, mapPrices, relay, resetSteady, steady, toOracle, type Feed } from "../src/relay";

afterEach(() => (vi.restoreAllMocks(), resetSteady()));

// pyth feed ids checked against hermes /v2/price_feeds; BTC/USD is e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
const USDC = "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a";
const NEAR = "c415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750";
const MAP = { "tusdc.owner.testnet": { pyth: USDC, coingecko: "usd-coin" }, "tnear.owner.testnet": { pyth: "0x" + NEAR, coingecko: "near" } };
const DEC = { "tusdc.owner.testnet": 6, "tnear.owner.testnet": 24 };
const now = () => Math.floor(Date.now() / 1000);
const feed = (id: string, price: string, conf = "1000", age = 0, expo = -8): Feed => ({ id, price: { price, conf, expo, publish_time: now() - age } });
const fresh = () => [feed(USDC, "99994982"), feed(NEAR, "188428353")];

// vault math.rs usd_e6: raw * multiplier * 1e6 / 10^decimals
const usdE6 = (raw: bigint, p: { multiplier: string; decimals: number }) => (raw * BigInt(p.multiplier) * 1_000_000n) / 10n ** BigInt(p.decimals);
const fromUrl = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

describe("toOracle", () => {
  it.each([
    ["usdc 6 dec", 99994982n, -8, 6, 10n ** 6n, 999949n], // $0.99994982
    ["btc 8 dec", 7887689348217n, -8, 8, 10n ** 8n, 78876893482n], // $78876.89348217
    ["near 24 dec", 188428353n, -8, 24, 10n ** 24n, 1884283n], // $1.88428353
    ["positive expo", 5n, 30, 24, 10n ** 24n, 5n * 10n ** 36n], // $5e30 per token
  ])("%s: one whole token is its usd price", (_, px, expo, dec, raw, want) => {
    expect(usdE6(raw, toOracle(px, expo, dec))).toBe(want);
  });
});

describe("decimal", () => {
  it.each([
    ["0.9994733566637608", 9994733566637608n, -16],
    ["71337.0267195656", 713370267195656n, -10],
    ["3", 3n, 0],
    ["1e-7", 1n, -7],
    ["1.5e+21", 15n, 20],
  ])("%s is exact", (s, price, expo) => expect(decimal(s)).toEqual({ price, expo }));
  it.each(["-1", "abc", "1.", "NaN", "Infinity"])("%s is junk", (s) => expect(decimal(s)).toBeNull());
});

describe("mapPrices", () => {
  it("renames pyth feeds to testnet tokens with token-decimal multipliers", () => {
    expect(mapPrices(MAP, "pyth", fromPyth(fresh(), now()), DEC)).toEqual([
      { asset_id: "tusdc.owner.testnet", price: { multiplier: "99994982", decimals: 14 } },
      { asset_id: "tnear.owner.testnet", price: { multiplier: "188428353", decimals: 32 } },
    ]);
  });
  it.each([
    ["an old publish_time", [feed(USDC, "99994982"), feed(NEAR, "188428353", "1000", 61)]],
    ["a wide confidence", [feed(USDC, "99994982"), feed(NEAR, "188428353", "3800000")]], // 2.02%
    ["a missing feed", [feed(USDC, "99994982")]],
    ["a junk price", [feed(USDC, "99994982"), feed(NEAR, "-5")]],
    ["a zero price", [feed(USDC, "99994982"), feed(NEAR, "0")]],
  ])("pyth: nothing on %s", (_, feeds) => expect(mapPrices(MAP, "pyth", fromPyth(feeds, now()), DEC)).toBeNull());

  // the live /simple/price shape
  const cg = (near: unknown, age = 0) => ({ "usd-coin": { usd: 0.9994733566637608, last_updated_at: now() }, near: { usd: near, last_updated_at: now() - age } });
  it("prices coingecko quotes exactly", () => {
    const [usdc, near] = mapPrices(MAP, "coingecko", fromCoingecko(cg(3.377458169138707), now()), DEC)!;
    expect(usdc.price).toEqual({ multiplier: "9994733566637608", decimals: 22 });
    expect(usdE6(10n ** 24n, near.price)).toBe(3377458n); // 1 NEAR = $3.377458
  });
  it.each([
    ["stale last_updated_at", cg(3.37, 301)],
    ["a zero price", cg(0)],
    ["a string price", cg("3.37")],
    ["a missing coin", { "usd-coin": cg(1)["usd-coin"] }],
  ])("coingecko: nothing on %s", (_, body) => expect(mapPrices(MAP, "coingecko", fromCoingecko(body, now()), DEC)).toBeNull());
});

describe("base58", () => {
  it("round trips with leading zeros", () => {
    const b = Uint8Array.from([0, 0, 1, 2, 255]);
    expect(b58decode(b58encode(b))).toEqual(b);
    expect(b58encode(new Uint8Array(32))).toBe("11111111111111111111111111111111");
  });
});

describe("relay", () => {
  it("is off without its config", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    expect(await relay(env)).toBe("off");
    expect(f).not.toHaveBeenCalled();
  });

  async function run(feeds: Feed[], hermesKey = "hk", map: object = MAP, cgStatus = 200) {
    const kp = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const jwk = (await crypto.subtle.exportKey("jwk", kp.privateKey)) as JsonWebKey;
    const secret = b58encode(Uint8Array.from([...fromUrl(jwk.d!), ...fromUrl(jwk.x!)]));
    const hash = b58encode(Uint8Array.from({ length: 32 }, (_, i) => i));
    const calls: { url: string; method: string; params: Record<string, string> }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (String(url).startsWith(env.HERMES_URL)) {
        expect(new Headers(init?.headers).get("authorization")).toBe("Bearer hk");
        calls.push({ url: String(url), method: "hermes", params: {} });
        return Response.json({ binary: { encoding: "hex", data: [] }, parsed: feeds });
      }
      if (String(url).startsWith(env.COINGECKO_URL)) {
        expect(new Headers(init?.headers).get("user-agent")).toBe("pakt-relay/1.0");
        calls.push({ url: String(url), method: "coingecko", params: {} });
        if (cgStatus !== 200) return new Response("Throttled", { status: cgStatus });
        return Response.json({ "usd-coin": { usd: 0.9994733566637608, last_updated_at: now() }, near: { usd: 3.377458169138707, last_updated_at: now() } });
      }
      if (String(url).startsWith(env.COINBASE_URL)) {
        calls.push({ url: String(url), method: "coinbase", params: {} });
        return Response.json({ data: { amount: String(url).includes("NEAR") ? "3.39275" : "1", currency: "USD" } });
      }
      expect(String(init?.body)).not.toContain(secret);
      const { method, params } = JSON.parse(String(init?.body));
      calls.push({ url: String(url), method: params.method_name ?? method, params });
      const result =
        params.method_name === "ft_metadata" ? { result: [...new TextEncoder().encode(JSON.stringify({ decimals: params.account_id.startsWith("tusdc") ? 6 : 24 }))] }
        : params.request_type === "view_access_key" ? { nonce: 41, block_hash: hash }
        : { status: { SuccessValue: "" } };
      return Response.json({ jsonrpc: "2.0", id: "pakt", result });
    });
    const e = { ...env, PRICE_MAP: JSON.stringify(map), PRICE_ORACLE: "oracle.owner.testnet", ORACLE_REPORTER: `rep.testnet:ed25519:${secret}`, HERMES_API_KEY: hermesKey };
    return { result: await relay(e), calls, pub: kp.publicKey, hash };
  }

  it("signs one report_prices tx the public key verifies", async () => {
    const { result, calls, pub, hash } = await run(fresh());
    expect(result).toBe("reported 2");
    expect(calls.map((c) => c.method)).toEqual(["ft_metadata", "ft_metadata", "hermes", "query", "send_tx"]);
    expect(calls[2].url).toBe(`${env.HERMES_URL}/v2/updates/price/latest?ids%5B%5D=${USDC}&ids%5B%5D=0x${NEAR}&parsed=true`);
    const signed = Uint8Array.from(atob(calls[4].params.signed_tx_base64), (c) => c.charCodeAt(0));
    const [tx, sig] = [signed.slice(0, -65), signed.slice(-64)];
    expect(signed[signed.length - 65]).toBe(0); // ed25519 signature tag
    const digest = await crypto.subtle.digest("SHA-256", tx);
    expect(await crypto.subtle.verify("Ed25519", pub, sig, digest)).toBe(true);
    // borsh: signer, key, nonce, receiver, block hash, then the FunctionCall
    const dv = new DataView(tx.buffer);
    const signer = new TextDecoder().decode(tx.slice(4, 4 + dv.getUint32(0, true)));
    expect(signer).toBe("rep.testnet");
    let o = 4 + signer.length + 33;
    expect(dv.getBigUint64(o, true)).toBe(42n);
    o += 8;
    const rlen = dv.getUint32(o, true);
    expect(new TextDecoder().decode(tx.slice(o + 4, o + 4 + rlen))).toBe("oracle.owner.testnet");
    o += 4 + rlen;
    expect(b58encode(tx.slice(o, o + 32))).toBe(hash);
    const text = new TextDecoder().decode(tx);
    expect(text).toContain("report_prices");
    expect(text).toContain(`{"prices":[{"asset_id":"tusdc.owner.testnet","price":{"multiplier":"99994982","decimals":14}}`);
  });

  it("stale pyth falls back to coingecko", async () => {
    const { result, calls } = await run([feed(USDC, "99994982"), feed(NEAR, "188428353", "1000", 120)]);
    expect(result).toBe("reported 2");
    expect(calls.map((c) => c.method)).toEqual(["hermes", "coingecko", "query", "send_tx"]); // decimals cached from the last round
  });

  it("tries coinbase before coingecko", async () => {
    const cb = { "tusdc.owner.testnet": { ...MAP["tusdc.owner.testnet"], coinbase: "USDC-USD" }, "tnear.owner.testnet": { ...MAP["tnear.owner.testnet"], coinbase: "NEAR-USD" } };
    const { result, calls } = await run([], "", cb, 429);
    expect(result).toBe("reported 2");
    expect(calls.filter((c) => c.method === "coinbase").map((c) => c.url)).toEqual([`${env.COINBASE_URL}/v2/prices/USDC-USD/spot`, `${env.COINBASE_URL}/v2/prices/NEAR-USD/spot`]);
    expect(calls.some((c) => c.method === "coingecko")).toBe(false);
    expect(calls.at(-1)!.method).toBe("send_tx");
  });

  it("holds a >20% jump until it repeats 3 rounds", () => {
    const p = (m: string) => [{ asset_id: "t", price: { multiplier: m, decimals: 0 } }];
    expect(steady(p("100"))).toBe(true);
    expect(steady(p("10"))).toBe(false);
    expect(steady(p("101"))).toBe(true); // glitch gone: back to normal, strikes reset
    expect(steady(p("10"))).toBe(false);
    expect(steady(p("10"))).toBe(false);
    expect(steady(p("10"))).toBe(true); // a real move lands on the 3rd round
  });

  it("falls back to one keyless coingecko call without a hermes key", async () => {
    const { result, calls } = await run([], "");
    expect(result).toBe("reported 2");
    expect(calls.map((c) => c.method)).toEqual(["coingecko", "query", "send_tx"]);
    expect(calls[0].url).toBe(`${env.COINGECKO_URL}/api/v3/simple/price?ids=usd-coin,near&vs_currencies=usd&include_last_updated_at=true&precision=full`);
  });
});
