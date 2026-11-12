// D1 access. Every value is bound; column names come from code constants only.
import { FIELDS, type NewEvent } from "./chain";

export type Row = Omit<NewEvent, "log_idx" | "data_idx"> & { id: number };
export type Event = Omit<Row, "data"> & { data: Record<string, unknown> };

const COLS = "id, height, ts_ms, tx_hash, receipt_id, emitter, vault, kind, actor, data";

const short = (v: unknown) =>
  typeof v === "number" || typeof v === "boolean" || (typeof v === "string" && v.length <= 256);

// project keeps only the allowlisted primitive fields of a kind, so raw chain json is never echoed.
export function project(kind: string, raw: string): Record<string, unknown> {
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(raw);
  } catch {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const f of FIELDS[kind] ?? []) {
    const v = d[f];
    if (short(v)) out[f] = v;
    else if (f === "payouts" && Array.isArray(v))
      out[f] = v.slice(0, 32).map((p) => ({ token: String(p?.token ?? "").slice(0, 256), amount: String(p?.amount ?? "").slice(0, 64) }));
  }
  return out;
}

export const toEvent = (r: Row): Event => ({ ...r, data: project(r.kind, r.data) });

export async function cursor(db: D1Database): Promise<number> {
  return (await db.prepare("select height from cursor").first<number>("height")) ?? 0;
}

// save inserts a step's events and advances the cursor atomically; returns only the new rows.
export async function save(db: D1Database, height: number, evs: NewEvent[]): Promise<Row[]> {
  const [ins] = await db.batch<Row>([
    db.prepare(`insert or ignore into events (height, ts_ms, tx_hash, receipt_id, log_idx, data_idx, emitter, vault, kind, actor, data)
      select value->>'height', value->>'ts_ms', value->>'tx_hash', value->>'receipt_id', value->>'log_idx', value->>'data_idx',
        value->>'emitter', value->>'vault', value->>'kind', value->>'actor', value->>'data'
      from json_each(?1) returning ${COLS}`).bind(JSON.stringify(evs)),
    db.prepare("insert into cursor (id, height) values (1, ?1) on conflict (id) do update set height = excluded.height").bind(height),
  ]);
  return ins.results.sort((a, b) => a.id - b.id);
}

export type FeedCol = "kind" | "vault" | "actor";

export async function feed(db: D1Database, col: FeedCol | null, val: string, before: number, limit: number): Promise<Row[]> {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (col) where.push(`${col} = ?${args.push(val)}`);
  if (before) where.push(`id < ?${args.push(before)}`);
  const sql = `select ${COLS} from events ${where.length ? "where " + where.join(" and ") : ""} order by id desc limit ?${args.push(limit)}`;
  return (await db.prepare(sql).bind(...args).all<Row>()).results;
}

export async function since(db: D1Database, kinds: string[], sinceMs: number): Promise<Row[]> {
  const marks = kinds.map((_, i) => `?${i + 2}`).join(", ");
  return (await db.prepare(`select ${COLS} from events where kind in (${marks}) and ts_ms >= ?1 order by id`)
    .bind(sinceMs, ...kinds).all<Row>()).results;
}

export type Pakt = { id: number; vault: string; created_at: number; info: Record<string, unknown> };

// pakts indexes vaults by first event; info is pakt_created data, {} until the factory emits it.
// shortcut: groups all events per request, add a pakts table once that gets slow.
export async function pakts(db: D1Database, vault: string, before: number, limit: number): Promise<Pakt[]> {
  const rows = await db.prepare(`with v as (
      select vault, min(id) as id, min(ts_ms) as ts from events where vault <> '' and (?1 = '' or vault = ?1) group by vault)
    select v.id, v.vault, v.ts as created_at,
      (select data from events e where e.vault = v.vault and e.kind = 'pakt_created' order by e.id limit 1) as info
    from v where (?2 = 0 or v.id < ?2) order by v.id desc limit ?3`).bind(vault, before, limit)
    .all<{ id: number; vault: string; created_at: number; info: string | null }>();
  return rows.results.map((r) => ({ ...r, info: r.info ? project("pakt_created", r.info) : {} }));
}
