import { env as testEnv } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { faucet } from "../src/faucet";

const env = (over: Partial<Env> = {}) => ({ ...testEnv, FAUCET_DRIPS: '{"t.testnet":"1"}', FAUCET_SIGNER: "a.testnet:ed25519:x", ...over }) as Env;

describe("faucet", () => {
  it("is off without a signer", async () => {
    expect((await faucet(env({ FAUCET_SIGNER: undefined }), "bob.testnet", "1.2.3.4")).status).toBe(404);
  });
  it("rejects bad account ids before any rpc", async () => {
    for (const a of [null, "", "Bob.testnet", "a..b", "x".repeat(65)]) expect((await faucet(env(), a, "1.2.3.4")).status).toBe(400);
  });
  it("limits one claim per account and three per ip per day, before any rpc", async () => {
    const now = Date.now();
    await testEnv.DB.prepare("insert into faucet_claims (account, ip, at) values ('bob.testnet','9.9.9.9',?),('a1.testnet','5.5.5.5',?),('a2.testnet','5.5.5.5',?),('a3.testnet','5.5.5.5',?)").bind(now, now, now, now).run();
    expect(await faucet(env(), "bob.testnet", "1.1.1.1")).toEqual({ status: 429, body: { error: "one claim per account per day" } });
    expect(await faucet(env(), "carol.testnet", "5.5.5.5")).toEqual({ status: 429, body: { error: "daily limit reached on this network" } });
  });
});
