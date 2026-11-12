import { afterEach, describe, expect, it, vi } from "vitest";
import { BadBlock, Budget, events, Neardata, parseLog, Rpc, trusted, Upstream, type Block } from "../src/chain";
import block from "./fixtures/neardata-block.json";
import rpc from "./fixtures/rpc.json";

afterEach(() => vi.restoreAllMocks());

describe("parseLog", () => {
  it.each([
    [`EVENT_JSON:{"standard":"pakt","version":"1.0.0","event":"hired","data":[{"trader":"bob.testnet"}]}`, "hired"],
    [`EVENT_JSON:{"standard":"nep141","version":"1.0.0","event":"ft_mint","data":[{}]}`, null],
    [`EVENT_JSON:{"standard":"pakt","version":"1.0.0","event":"rug","data":[{}]}`, null],
    [`EVENT_JSON:{"standard":"pakt","event":"hired","data":{}}`, null],
    [`EVENT_JSON:{bad`, null],
    [`hired bob.testnet`, null],
  ])("%s", (line, kind) => expect(parseLog(line)?.kind ?? null).toBe(kind));
});

describe("emitter trust", () => {
  it("is exact on the suffix", () => {
    expect(trusted("pakt.testnet", "pakt.testnet")).toBe(true);
    expect(trusted("alpha.pakt.testnet", "pakt.testnet")).toBe(true);
    expect(trusted("evilpakt.testnet", "pakt.testnet")).toBe(false);
    expect(trusted("pakt.testnet.evil.testnet", "pakt.testnet")).toBe(false);
    expect(trusted("x.alpha.pakt.testnet", "pakt.testnet")).toBe(false);
  });
});

describe("neardata block", () => {
  it("keeps pakt events from trusted, successful receipts only", () => {
    const evs = events(block as Block, "pakt.testnet");
    // dropped: failed receipt, look-alike evilpakt.testnet, nep141, plain text, bad json
    expect(evs.map((e) => [e.kind, e.vault, e.actor, e.emitter])).toEqual([
      ["pakt_created", "alpha.pakt.testnet", "alice.testnet", "pakt.testnet"],
      ["trade", "alpha.pakt.testnet", "bob.testnet", "alpha.pakt.testnet"],
    ]);
    expect(evs[1]).toMatchObject({ tx_hash: "tx2", receipt_id: "r2", log_idx: 3, data_idx: 0, height: 1000, ts_ms: 1794489970886 });
  });

  it("reads null as a skipped height and puts the key in the query", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("null"));
    expect(await new Neardata("https://nd.test", "k&y").block(new Upstream(5), 7)).toBeNull();
    expect(String(f.mock.calls[0][0])).toBe("https://nd.test/v0/block/7?apiKey=k%26y");
  });
});

describe("rpc source", () => {
  const fixture = rpc as Record<string, unknown>;
  const serve = () =>
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const { method, params } = JSON.parse(String(init?.body));
      const key = `${method} ${params.finality ?? params.block_id ?? params.chunk_id ?? params.tx_hash}`;
      if (key in fixture) return Response.json({ jsonrpc: "2.0", id: "pakt", result: fixture[key] });
      expect(key).not.toBe("chunk OLD"); // chunks carried over from older blocks are not refetched
      // nearcore answers a skipped height with 422
      return Response.json({ jsonrpc: "2.0", id: "pakt", error: { name: "HANDLER_ERROR", cause: { name: "UNKNOWN_BLOCK" }, message: "DB Not Found" } }, { status: 422 });
    });

  it("walks block, chunk, tx status and dedupes receipts", async () => {
    serve();
    const src = new Rpc("http://localhost:3030");
    const up = new Upstream(40);
    expect(await src.final(up)).toBe(101);
    expect(await src.block(up, 101)).toBeNull(); // skipped height
    await expect(src.block(up, 7)).rejects.toThrow("pruned"); // below earliest_block_height
    const evs = events((await src.block(up, 100))!, "pakt.test.near");
    expect(evs.map((e) => [e.kind, e.tx_hash, e.receipt_id, e.height])).toEqual([
      ["deposit", "T1", "R2", 100],
      ["hired", "T2", "R3", 100],
    ]);
  });
});

describe("upstream", () => {
  it("stops at the subrequest budget", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({}));
    const up = new Upstream(1);
    await up.json("https://x.test/a");
    await expect(up.json("https://x.test/b")).rejects.toBeInstanceOf(Budget);
  });

  it("rejects oversize and unparsable bodies as bad blocks, and keeps the key out of errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("x", { headers: { "content-length": String(64 << 20) } }));
    await expect(new Upstream(5).json("https://x.test/v0/block/1?apiKey=secret")).rejects.toBeInstanceOf(BadBlock);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{nope"));
    await expect(new Upstream(5).json("https://x.test/v0/block/1?apiKey=secret")).rejects.toBeInstanceOf(BadBlock);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("slow down", { status: 429 }));
    await expect(new Upstream(5).json("https://x.test/v0/block/1?apiKey=secret")).rejects.toThrow(/^\/v0\/block\/1: 429 slow down$/);
  });
});
