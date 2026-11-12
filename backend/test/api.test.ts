import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { cacheKey, clientKey, route } from "../src/api";
import type { Block, NewEvent, Source } from "../src/chain";
import { BadBlock, Upstream } from "../src/chain";
import worker from "../src/index";
import { step } from "../src/indexer";
import { cursor, save } from "../src/store";

const ev = (i: number, kind: string, vault: string, actor: string, data: object): NewEvent => ({
  height: i, ts_ms: Date.now(), tx_hash: `t${i}`, receipt_id: `r${i}`, log_idx: 0, data_idx: 0,
  emitter: vault, vault, kind, actor, data: JSON.stringify(data),
});

async function get(path: string, init: RequestInit<IncomingRequestCfProperties> = {}, e: Env = env) {
  const ctx = createExecutionContext();
  const res = await worker.fetch(new Request<unknown, IncomingRequestCfProperties>(`http://pakt.test${path}`, init), e, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

beforeAll(async () => {
  await save(env.DB, 3, [
    ev(1, "pakt_created", "alpha.pakt.testnet", "alice.testnet",
      { name: "alpha", vault: "alpha.pakt.testnet", dao: "alpha.sputnik-dao.testnet", creator: "alice.testnet", join_mode: "open" }),
    ev(2, "deposit", "alpha.pakt.testnet", "alice.testnet",
      { account: "alice.testnet", amount: "5000000", shares: "5000000", value: "5000000", evil: "<script>" }),
    ev(3, "member_synced", "alpha.pakt.testnet", "alice.testnet", { account: "alice.testnet", added: true }),
  ]);
});

describe("routes on local D1", () => {
  it("serves the feed newest first with projected data only", async () => {
    const res = await get("/accounts/alice.testnet/feed?limit=2", { headers: { origin: "http://localhost:3000" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const body = await res.json<{ items: { kind: string; data: object }[]; next: number }>();
    expect(body.items.map((e) => e.kind)).toEqual(["member_synced", "deposit"]);
    expect(body.items[1].data).toEqual({ account: "alice.testnet", amount: "5000000", shares: "5000000", value: "5000000" });
    expect(body.next).toBeTypeOf("number");
  });

  it("serves copy-pakt config and trader records", async () => {
    const cfg = await (await get("/pakts/alpha.pakt.testnet/config")).json<{ name: string; trader: null }>();
    expect(cfg).toMatchObject({ vault: "alpha.pakt.testnet", name: "alpha", dao: "alpha.sputnik-dao.testnet", trader: null });
    expect((await get("/pakts/nope.pakt.testnet/config")).status).toBe(404);
    expect(await (await get("/traders/bob.testnet")).json()).toMatchObject({ trader: "bob.testnet", pnl: "0", pakts: [] });
    expect((await get("/traders/BAD")).status).toBe(400);
  });

  it("lists pakts and 404s unknown ones", async () => {
    const one = await (await get("/pakts/alpha.pakt.testnet")).json<{ vault: string; info: { name: string } }>();
    expect(one).toMatchObject({ vault: "alpha.pakt.testnet", info: { name: "alpha" } });
    expect((await get("/pakts/nope.pakt.testnet")).status).toBe(404);
  });

  it("does not echo a disallowed origin", async () => {
    const res = await get("/pakts", { headers: { origin: "https://evil.example" } });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("guards", () => {
  it.each([
    ["/accounts/Bad..Acct/feed", 400],
    ["/pakts/x/feed", 400], // too short
    ["/feed?limit=10000", 400],
    ["/feed?limit=-1", 400],
    ["/feed?kind=rug", 400],
    ["/alerts?window=99y", 400],
    ["/leaderboard?range=1y", 400],
    ["/pakts/%E0%A4%A", 400],
    ["/nope", 404],
    ["/feed/extra", 404],
  ])("%s -> %i", async (path, status) => {
    const res = await get(path);
    expect(res.status).toBe(status);
    expect(Object.keys(await res.json<object>())).toEqual(["error"]);
  });

  it("allows only GET and OPTIONS", async () => {
    for (const method of ["POST", "PUT", "DELETE", "PATCH"]) expect((await get("/feed", { method })).status).toBe(405);
    expect((await get("/feed", { method: "OPTIONS" })).status).toBe(204);
    expect((await get("/admin/start", { method: "POST" })).status).toBe(404); // no ADMIN_TOKEN: fail closed
    const admin = { ...env, ADMIN_TOKEN: "s3cret" };
    expect((await get("/admin/start", { method: "POST", headers: { authorization: "Bearer nope!!" } }, admin)).status).toBe(401);
  });

  it("returns 429 with retry-after when the limiter says no", async () => {
    const limited = { ...env, API_LIMIT: { limit: async () => ({ success: false }) } };
    const res = await get("/feed", {}, limited);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
  });

  it("keys IPv6 clients by /64 and marks errors no-store", async () => {
    const k = (ip: string) => clientKey(new Request("http://h/", { headers: { "cf-connecting-ip": ip } }));
    expect(k("2001:DB8:0:1::5")).toBe(k("2001:db8:0000:1:ffff:1:2:3"));
    expect(k("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(k("2001:db8:0:2::1")).not.toBe(k("2001:db8:0:1::1"));
    expect(k("1.2.3.4")).toBe("1.2.3.4");
    expect((await get("/nope")).headers.get("cache-control")).toBe("no-store");
  });

  it("filters alerts by window from the shared scan", async () => {
    const t = (n: string, trader: string, ago: number) => ({ ...ev(3, "trade", "alpha.pakt.testnet", trader,
      { trader, token_in: "usdc.testnet", token_out: "wnear.testnet", value: "1" }), tx_hash: n, receipt_id: n, ts_ms: Date.now() - ago });
    await save(env.DB, 3, [t("a1", "carol.testnet", 0), t("a2", "dave.testnet", 3_600_000)]);
    expect((await (await get("/alerts?window=1m")).json<{ items: unknown[] }>()).items).toEqual([]);
    expect((await (await get("/alerts?window=2h")).json<{ items: { count: number }[] }>()).items[0].count).toBe(2);
  });

  it("normalizes cache keys", () => {
    const key = (u: string) => cacheKey(new URL(u), route(new URL(u))!);
    expect(key("http://h/feed?zzz=1&limit=050&kind=deposit")).toBe(key("http://h/feed?kind=deposit&limit=50"));
    expect(key("http://h/alerts?window=60m&utm=x")).toBe(key("http://h/alerts?window=1h"));
    expect(key("http://h/feed?limit=5")).not.toBe(key("http://h/feed?limit=6"));
  });
});

describe("indexer step", () => {
  const blk = (h: number, logs: string[]): Block => ({
    block: { header: { height: h, timestamp: h * 1e9 } },
    shards: [{ receipt_execution_outcomes: [{ tx_hash: `tx${h}`, execution_outcome: { id: `rx${h}`, outcome: { executor_id: "beta.pakt.testnet", logs, status: { SuccessValue: "" } } } }] }],
  });
  const hired = `EVENT_JSON:{"standard":"pakt","version":"1.0.0","event":"hired","data":[{"trader":"bob.testnet"}]}`;

  it("saves and sends progress, skips bad blocks, and keeps the cursor on upstream errors", async () => {
    const src: Source = {
      final: async () => 13,
      block: async (_up, h) => {
        if (h === 11) throw new BadBlock("too large");
        if (h === 9) return { ...blk(h, []), shards: [{ receipt_execution_outcomes: [{ execution_outcome: { outcome: {} } }] }] } as Block; // wrong shape
        if (h === 13) throw new Error("503 upstream");
        return blk(h, [hired]);
      },
    };
    let sent = 0;
    await expect(step(env, src, new Upstream(40), (rows) => (sent += rows.length))).rejects.toThrow("503");
    expect(sent).toBe(7);
    expect(await cursor(env.DB)).toBe(12); // 4..12 saved but 9 and 11 skipped, 13 retried next alarm
    const res = await (await get("/accounts/bob.testnet/feed")).json<{ items: { height: number }[] }>();
    expect(res.items.map((e) => e.height)).toEqual([12, 10, 8, 7, 6, 5, 4]);
  });
});
