// Indexer: one Durable Object that runs the alarm-driven index loop and fans new events out over hibernated WebSockets.
import { DurableObject } from "cloudflare:workers";
import { BadBlock, Budget, events, Neardata, Rpc, type NewEvent, type Source, Upstream } from "./chain";
import { cursor, save, toEvent, type Row } from "./store";

const SUBREQUESTS = 40; // free plan allows 50 per invocation; D1 and slack take the rest
const MAX_BLOCKS = 20;
const STEP_MS = 20_000;
const TIP_DELAY_MS = 2_500;
const MAX_SOCKETS = 500;
const MAX_PER_IP = 5;
const IDLE_MS = 120_000; // clients send "ping" more often than this

export function source(env: Env): Source {
  return env.NEAR_RPC_URL ? new Rpc(env.NEAR_RPC_URL, env.FASTNEAR_API_KEY) : new Neardata(env.NEARDATA_URL, env.FASTNEAR_API_KEY);
}

// step indexes up to MAX_BLOCKS final blocks after the cursor. Progress is saved, and sent, even when a later block fails.
export async function step(env: Env, src: Source, up: Upstream, sent: (rows: Row[]) => void = () => {}): Promise<{ saved: Row[]; caughtUp: boolean }> {
  const c = await cursor(env.DB);
  let h = c ? c + 1 : Number(env.START_HEIGHT) || 0; // 0 = start at the final tip
  const evs: NewEvent[] = [];
  let last = 0, final = 0, caughtUp = false, err: unknown = null;
  const deadline = Date.now() + STEP_MS;
  try {
    for (let n = 0; n < MAX_BLOCKS && Date.now() < deadline; n++) {
      if (!h || h > final) {
        final = await src.final(up);
        h ||= final;
        if (h > final) {
          caughtUp = true;
          break;
        }
      }
      let b = null;
      try {
        b = await src.block(up, h);
        if (b) evs.push(...events(b, env.PAKT_FACTORY));
      } catch (e) {
        // got a block but events() threw: wrong shape, retrying would wedge the cursor
        if (!(e instanceof BadBlock || (b && e instanceof TypeError))) throw e;
        console.error(JSON.stringify({ msg: "skip bad block", height: h, err: String(e) }));
      }
      last = h++;
    }
  } catch (e) {
    if (!(e instanceof Budget)) err = e;
  }
  const saved = last ? await save(env.DB, last, evs) : [];
  sent(saved);
  if (err) throw err;
  return { saved, caughtUp };
}

export class Indexer extends DurableObject<Env> {
  private fails = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // answered without waking the object, and stamps the socket's last activity
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  // start is idempotent: it only arms an alarm when none is pending.
  async start(): Promise<void> {
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now());
  }

  async alarm(): Promise<void> {
    const t0 = Date.now();
    let delay: number;
    try {
      const perMin = Number(this.env.UPSTREAM_PER_MIN) || 30;
      // ~10s worth of calls per step keeps bursts inside a per-minute upstream window
      const up = new Upstream(Math.min(SUBREQUESTS, Math.max(2, Math.ceil(perMin / 6))));
      const { caughtUp } = await step(this.env, source(this.env), up, (rows) => this.broadcast(rows));
      this.fails = 0;
      // pace upstream calls to UPSTREAM_PER_MIN, counting the time the step already took
      const pace = (up.calls * 60_000) / perMin - (Date.now() - t0);
      delay = Math.max(caughtUp ? TIP_DELAY_MS : 250, pace);
    } catch (e) {
      this.fails++;
      delay = Math.min(60_000, 2_000 * 2 ** this.fails);
      console.error(JSON.stringify({ msg: "index step failed", fails: this.fails, err: String(e) }));
    }
    this.dropIdle();
    await this.ctx.storage.setAlarm(Date.now() + delay);
  }

  private broadcast(rows: Row[]) {
    if (!rows.length) return;
    const msgs = rows.map((r) => JSON.stringify(toEvent(r)));
    for (const ws of this.ctx.getWebSockets()) {
      try {
        for (const m of msgs) ws.send(m);
      } catch {
        // closed between list and send
      }
    }
  }

  private dropIdle() {
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      const at = (ws.deserializeAttachment() as { at: number } | null)?.at ?? 0;
      const pinged = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
      if (now - Math.max(at, pinged) > IDLE_MS) ws.close(1000, "idle");
    }
  }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") return Response.json({ error: "expected websocket" }, { status: 426 });
    const ip = req.headers.get("cf-connecting-ip") ?? "local";
    if (this.ctx.getWebSockets().length >= MAX_SOCKETS) return Response.json({ error: "busy" }, { status: 503, headers: { "retry-after": "60" } });
    if (this.ctx.getWebSockets(ip).length >= MAX_PER_IP) return Response.json({ error: "too many sockets" }, { status: 429, headers: { "retry-after": "60" } });
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server, [ip]);
    server.serializeAttachment({ at: Date.now() });
    return new Response(null, { status: 101, webSocket: client });
  }

  // the stream is server to client only; anything but the auto-answered ping closes the socket
  async webSocketMessage(ws: WebSocket): Promise<void> {
    ws.close(1008, "read only");
  }
}
