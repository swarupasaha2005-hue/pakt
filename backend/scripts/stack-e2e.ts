// Stack test: real contracts on a NEAR sandbox -> local Worker (wrangler dev, fresh local D1) -> HTTP + WebSocket asserts.
// Run `make stack-e2e`, or `CONTRACTS_DIR=<cargo workspace with e2e/> bun scripts/stack-e2e.ts` in backend/. PORT defaults to 8788.
// `--smoke` (make smoke): one pakt + one deposit, checks /healthz, /pakts and /feed only.
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { FIELDS } from "../src/chain";
import type { Event } from "../src/store";

const BACKEND = path.resolve(import.meta.dir, "..");
const CONTRACTS = path.resolve(process.env.CONTRACTS_DIR ?? path.join(BACKEND, "../contracts"));
const PORT = Number(process.env.PORT ?? 8788);
const BASE = `http://127.0.0.1:${PORT}`;
const SMOKE = process.argv.includes("--smoke");
const PERSIST = mkdtempSync(path.join(tmpdir(), "pakt-stack-"));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function assert(ok: unknown, msg: string): asserts ok {
  if (!ok) throw new Error(`assert: ${msg}`);
}

// sandbox: cargo run of contracts/e2e/src/bin/stack.rs, spoken to over stdin/stdout lines
const stack = spawn("cargo", ["run", "-q", "-p", "pakt-e2e", "--bin", "stack", "--", ...(SMOKE ? ["smoke"] : [])], { cwd: CONTRACTS, stdio: ["pipe", "pipe", "inherit"] });
const waiters: ((line: string) => boolean)[] = [];
createInterface({ input: stack.stdout! }).on("line", (l) => {
  if (!l.startsWith("STACK ")) return;
  const i = waiters.findIndex((w) => w(l.slice(6)));
  if (i >= 0) waiters.splice(i, 1);
});
// any wait fails at once if the sandbox dies
const died = new Promise<never>((_, fail) => stack.on("exit", (code) => fail(new Error(`sandbox exited ${code}`))));
died.catch(() => {});
const said = (prefix: string, ms = 600_000) =>
  Promise.race([died, new Promise<string>((ok, fail) => {
    const t = setTimeout(() => fail(new Error(`sandbox never said ${prefix}`)), ms);
    waiters.push((l) => l.startsWith(prefix) && (clearTimeout(t), ok(l.slice(prefix.length)), true));
  })]);

async function live() {
  const done = said("ok", 60_000);
  stack.stdin!.write("live\n");
  await done;
}

let worker: ChildProcess | null = null;
const wrangler = (args: string[], detached = false) =>
  spawn("bunx", ["wrangler", ...args, "--persist-to", PERSIST], { cwd: BACKEND, detached, stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, CI: "1" } });

function startWorker(rpc: string, factory: string) {
  worker = wrangler(["dev", "--ip", "127.0.0.1", "--port", String(PORT), "--var", `NEAR_RPC_URL:${rpc}`, "--var", `PAKT_FACTORY:${factory}`,
    "--var", "START_HEIGHT:1", "--var", "UPSTREAM_PER_MIN:6000", "--var", "CORS_ORIGINS:http://localhost:3000"], true);
}
async function stopWorker() {
  if (!worker) return;
  const w = worker;
  worker = null;
  const gone = new Promise((r) => w.once("exit", r));
  process.kill(-w.pid!, "SIGTERM"); // the whole group: bunx -> wrangler -> workerd
  await Promise.race([gone, sleep(5_000)]);
}

// unique limit per call: the Worker caches by validated params, so each poll gets a fresh read
let lim = 200;
async function get<T>(route: string): Promise<T> {
  const url = `${BASE}${route}${route.includes("?") ? "&" : "?"}limit=${lim > 100 ? lim-- : (lim = 200)}`;
  for (let i = 0; ; i++) {
    const res = await fetch(url).catch(() => null);
    if (res?.status === 200) return (await res.json()) as T;
    if (i > 60) throw new Error(`${route}: ${res?.status} ${await res?.text()}`);
    await sleep(res?.status === 429 ? 5_000 : 1_000); // not up yet, or the local rate limit
  }
}
const feed = async (route: string) => (await get<{ items: Event[] }>(route)).items.reverse(); // oldest first

async function until<T>(what: string, f: () => Promise<T | null | undefined | false>, ms = 180_000): Promise<T> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await f();
    if (v) return v;
    await sleep(2_000);
  }
  throw new Error(`timed out waiting for ${what}`);
}

const noDupes = (evs: Event[]) => {
  const keys = evs.map((e) => `${e.receipt_id}|${e.kind}|${JSON.stringify(e.data)}`);
  assert(new Set(keys).size === keys.length, "duplicate events");
  assert(new Set(evs.map((e) => e.id)).size === evs.length, "duplicate ids");
};

async function main() {
  const [up, ready] = [said("rpc="), said("ready ")];
  const [, rpc, factory] = /^(\S+) factory=(\S+)$/.exec(await up)!;
  // index while the scenario runs: the sandbox prunes old blocks fast once it fast-forwards
  await new Promise((ok, fail) => wrangler(["d1", "migrations", "apply", "pakt", "--local"]).on("exit", (c) => (c ? fail(new Error("migrate")) : ok(0))));
  startWorker(rpc, factory);
  await get("/healthz"); // arms the indexer
  const ids = JSON.parse(await ready) as Record<"vault" | "dao" | "usdc" | "a" | "b" | "c" | "t" | "x", string>;
  console.log(`sandbox ${rpc}, factory ${factory}, vault ${ids.vault}`);
  if (SMOKE) {
    const evs = await until("pakt_created and deposit in /feed", async () => {
      const f = await feed("/feed");
      return ["pakt_created", "deposit"].every((k) => f.some((e) => e.kind === k && e.vault === ids.vault)) && f;
    }, 60_000);
    const list = await get<{ items: { vault: string; info: { name?: string } }[] }>("/pakts");
    assert(list.items.find((p) => p.vault === ids.vault)?.info.name === "moon", "/pakts misses the pakt");
    console.log(`smoke: ${evs.map((e) => e.kind).join(" ")}`);
    return;
  }

  const vf = await until("claim in the vault feed", async () => {
    const evs = await feed(`/pakts/${ids.vault}/feed`);
    return evs.some((e) => e.kind === "claim") && evs;
  });
  noDupes(vf);
  const of = (kind: string) => vf.filter((e) => e.kind === kind);
  const kinds = ["pakt_created", "deposit", "member_synced", "offer", "declined", "hired", "cap_set", "trade", "settled", "leave", "paused", "resumed", "fired", "claim"];
  for (const k of kinds) assert(of(k).length, `no ${k} event in ${vf.map((e) => e.kind)}`);
  for (const e of vf) {
    assert(e.vault === ids.vault, `${e.kind} vault ${e.vault}`);
    assert(e.emitter === (e.kind === "pakt_created" ? factory : ids.vault), `${e.kind} emitter ${e.emitter}`);
    // every allowlisted field is served (payouts is the one non-primitive)
    assert(JSON.stringify(Object.keys(e.data).sort()) === JSON.stringify([...FIELDS[e.kind]].sort()), `${e.kind} fields ${Object.keys(e.data)}`);
  }
  const [created] = of("pakt_created");
  assert(JSON.stringify(created.data) === JSON.stringify({ name: "moon", vault: ids.vault, dao: ids.dao, creator: ids.a, join_mode: "Open" }), `pakt_created ${JSON.stringify(created.data)}`);
  assert(created.actor === ids.a, "pakt_created actor");
  assert(of("deposit").map((e) => `${e.actor}:${e.data.amount}`).join() === `${ids.a}:100000000,${ids.b}:200000000,${ids.c}:300000000`, "deposits");
  const synced = of("member_synced").map((e) => `${e.data.account}:${e.data.added}`).sort();
  assert(synced.join() === [`${ids.a}:true`, `${ids.b}:false`, `${ids.b}:true`, `${ids.c}:true`].join(), `member_synced ${synced}`);
  assert(of("offer").map((e) => e.data.trader).join() === `${ids.x},${ids.t}`, "offers");
  assert(of("declined")[0].data.trader === ids.x && of("hired")[0].data.trader === ids.t && of("fired")[0].data.trader === ids.t, "trader lifecycle");
  const [trade] = of("trade");
  assert(trade.actor === ids.t && trade.data.token_in === ids.usdc && trade.data.amount_in === "50000000" && BigInt(trade.data.amount_out as string) > 0n, `trade ${JSON.stringify(trade.data)}`);
  assert(of("paused")[0].data.reason === "stop_loss", "paused reason");
  assert(of("leave").map((e) => e.actor).join() === `${ids.b},${ids.t}`, "leaves");
  const leaveB = of("leave")[0].data.payouts as { token: string; amount: string }[];
  assert(leaveB.length && leaveB.every((p) => /^\d+$/.test(p.amount)), "leave payouts");
  const claim = of("claim")[0].data;
  assert(claim.account === ids.t && claim.token === ids.usdc && BigInt(claim.amount as string) > 0n, `claim ${JSON.stringify(claim)}`);

  // trader pnl = settled profit while t was live
  const [hired, fired] = [of("hired")[0].id, of("fired")[0].id];
  const pnl = of("settled").filter((e) => e.id > hired && e.id < fired).reduce((s, e) => s + BigInt(e.data.profit as string), 0n);
  assert(pnl > 0n, "no profit settled under t");
  const lb = await get<{ traders: { items: { trader: string; pnl: string; volume: string; trades: number }[] } }>("/leaderboard");
  const row = lb.traders.items.find((r) => r.trader === ids.t);
  assert(row?.pnl === pnl.toString() && row.volume === trade.data.value && row.trades === 1, `leaderboard ${JSON.stringify(row)} want pnl ${pnl}`);

  const list = await get<{ items: { vault: string; info: Record<string, unknown> }[] }>("/pakts");
  assert(JSON.stringify(list.items.find((p) => p.vault === ids.vault)?.info) === JSON.stringify(created.data), "/pakts info");
  const one = await get<{ vault: string; info: { name: string } }>(`/pakts/${ids.vault}`);
  assert(one.info.name === "moon", "/pakts/{vault}");
  const af = await feed(`/accounts/${ids.a}/feed`);
  assert(["pakt_created", "deposit", "member_synced"].every((k) => af.some((e) => e.kind === k)) && af.every((e) => e.actor === ids.a), "/accounts feed");
  const all = await feed("/feed");
  assert(all.length === vf.length, `/feed has ${all.length}, vault feed ${vf.length}`); // only one pakt exists
  for (const k of kinds) assert((await feed(`/feed?kind=${k}`)).length === of(k).length, `/feed?kind=${k}`);
  console.log(`indexed ${vf.length} events: ${kinds.map((k) => `${k}x${of(k).length}`).join(" ")}; t pnl ${pnl}`);

  // stream: an event emitted after connect arrives live
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/stream`);
  await new Promise((ok, fail) => ((ws.onopen = ok), (ws.onerror = fail)));
  const got = new Promise<Event>((ok) => (ws.onmessage = (m) => {
    const e = JSON.parse(String(m.data)) as Event;
    if (e.kind === "deposit" && e.actor === ids.c) ok(e);
  }));
  await live();
  const pushed = await Promise.race([got, sleep(60_000).then(() => null)]);
  assert(pushed && pushed.data.amount === "10000000", "no live deposit on /stream");
  ws.close();
  console.log(`stream pushed deposit #${pushed.id}`);

  // restart: an event emitted while the Worker is down is caught up once, nothing doubles
  const before = await until("live deposit stored", async () => {
    const f = await feed("/feed");
    return f.some((e) => e.id === pushed.id) && f;
  });
  await stopWorker();
  await live();
  startWorker(rpc, factory);
  const after = await until("catch-up deposit", async () => {
    const f = await feed("/feed");
    return f.filter((e) => e.kind === "deposit").length === of("deposit").length + 2 && f;
  });
  noDupes(after);
  assert(JSON.stringify(after.slice(0, before.length)) === JSON.stringify(before), "history changed across restart");
  await sleep(5_000);
  noDupes(await feed("/feed"));
  console.log(`restart caught up: ${before.length} -> ${after.length} events, no duplicates`);
}

let code = 0;
try {
  await main();
  console.log("STACK E2E PASS");
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  await stopWorker();
  stack.stdin!.end();
  stack.kill();
  rmSync(PERSIST, { recursive: true, force: true });
}
process.exit(code);
