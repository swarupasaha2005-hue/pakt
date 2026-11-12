// Local run: start a NEAR sandbox (RPC on :3030), copy .dev.vars.example to .dev.vars and set PAKT_FACTORY,
// then `make backend-migrate && make backend` (wrangler dev --test-scheduled, local D1 and DO on :8787).
// The first request arms the indexer alarm: `curl localhost:8787/healthz`. /__scheduled exists in dev only.
// Deploy: `wrangler d1 create pakt`, paste the id into wrangler.jsonc, `wrangler d1 migrations apply pakt --remote`,
// `wrangler secret put ADMIN_TOKEN` (and FASTNEAR_API_KEY), then `wrangler deploy`.
import { BadInput, cacheKey, clientKey, route } from "./api";
import { faucet } from "./faucet";
import { relay } from "./relay";

export { Indexer } from "./indexer";

const SECURITY: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers });

function finish(res: Response, req: Request, env: Env): Response {
  const r = new Response(res.body, res); // cached responses have immutable headers
  for (const [k, v] of Object.entries(SECURITY)) r.headers.set(k, v);
  if (!r.headers.has("cache-control")) r.headers.set("cache-control", "no-store"); // errors, healthz, admin
  const origin = req.headers.get("origin");
  if (origin && originAllowed(env.CORS_ORIGINS, origin)) {
    r.headers.set("access-control-allow-origin", origin);
    r.headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
    r.headers.set("access-control-allow-headers", "content-type");
  }
  r.headers.append("vary", "origin");
  return r;
}

// CORS_ORIGINS entries are exact origins; one `*` matches a single dns label (vercel preview urls)
export function originAllowed(list: string, origin: string): boolean {
  return list.split(",").some((raw) => {
    const o = raw.trim();
    if (!o.includes("*")) return o === origin;
    const [head, tail] = o.split("*");
    return origin.startsWith(head) && origin.endsWith(tail) && /^[a-z\d-]+$/.test(origin.slice(head.length, origin.length - tail.length));
  });
}

const enc = new TextEncoder();

async function adminStart(req: Request, env: Env): Promise<Response> {
  if (!env.ADMIN_TOKEN) return json({ error: "not found" }, 404); // fail closed when unset
  const got = enc.encode(req.headers.get("authorization") ?? "");
  const want = enc.encode(`Bearer ${env.ADMIN_TOKEN}`);
  if (got.byteLength !== want.byteLength || !crypto.subtle.timingSafeEqual(got, want)) return json({ error: "unauthorized" }, 401);
  await env.INDEXER.getByName("main").start();
  return json({ started: true });
}

let booted = false; // per isolate, not request state: poke the idempotent start() once

async function handle(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  const stream = url.pathname === "/stream";
  if (!(await (stream ? env.STREAM_LIMIT : env.API_LIMIT).limit({ key: clientKey(req) })).success)
    return json({ error: "rate limited" }, 429, { "retry-after": "60" });
  if (!booted) {
    booted = true;
    ctx.waitUntil(env.INDEXER.getByName("main").start());
  }
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (url.pathname === "/admin/start" && req.method === "POST") return adminStart(req, env);
  if (url.pathname === "/faucet" && req.method === "POST") {
    if (!(await env.FAUCET_LIMIT.limit({ key: clientKey(req) })).success) return json({ error: "one request per minute" }, 429, { "retry-after": "60" });
    const d = await faucet(env, url.searchParams.get("account"), clientKey(req)).catch((e) => (console.error(JSON.stringify({ msg: "faucet failed", err: String(e) })), { status: 502, body: { error: "mint failed, try again" } }));
    return json(d.body, d.status);
  }
  if (req.method !== "GET") return json({ error: "method not allowed" }, 405, { allow: "GET, OPTIONS" });
  if (stream) return env.INDEXER.getByName("main").fetch(req);
  if (url.pathname === "/healthz") {
    await env.DB.prepare("select 1").first();
    return json({ status: "ok" });
  }
  let r;
  try {
    r = route(url);
  } catch (e) {
    if (e instanceof BadInput) return json({ error: e.message }, 400);
    throw e;
  }
  if (!r) return json({ error: "not found" }, 404);
  const key = cacheKey(url, r);
  let res = await caches.default.match(key);
  if (!res) {
    const body = await r.run(env.DB);
    if (body === null) return json({ error: "not found" }, 404);
    res = json(body, 200, { "cache-control": `public, max-age=${r.ttl}` });
    ctx.waitUntil(caches.default.put(key, res.clone()));
  }
  return res;
}

export default {
  async fetch(req, env, ctx) {
    let res: Response;
    try {
      res = await handle(req, env, ctx);
    } catch (e) {
      console.error(JSON.stringify({ msg: "request failed", path: new URL(req.url).pathname, err: String(e) }));
      res = json({ error: "internal" }, 500);
    }
    return res.status === 101 ? res : finish(res, req, env);
  },
  // daily safety net: re-arms the indexer alarm if its chain ever died. minutely: price relay, apart from the DO
  async scheduled(ctrl, env, ctx) {
    if (ctrl.cron !== "* * * * *") return ctx.waitUntil(env.INDEXER.getByName("main").start());
    ctx.waitUntil(relay(env).then(
      (r) => r !== "off" && console.log(JSON.stringify({ msg: "relay", result: r })),
      (e) => console.error(JSON.stringify({ msg: "relay failed", err: String(e) })),
    ));
  },
} satisfies ExportedHandler<Env>;
