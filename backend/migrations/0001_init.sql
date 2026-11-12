create table events (
  id         integer primary key,
  height     integer not null,
  ts_ms      integer not null,
  tx_hash    text    not null,
  receipt_id text    not null,
  log_idx    integer not null,
  data_idx   integer not null,
  emitter    text    not null,
  vault      text    not null,
  kind       text    not null,
  actor      text    not null,
  data       text    not null, -- raw event json; the api serves an allowlisted projection
  unique (receipt_id, log_idx, data_idx)
);
create index events_kind  on events (kind, id);
create index events_kind_ts on events (kind, ts_ms);
create index events_vault on events (vault, id);
create index events_actor on events (actor, id);

create table cursor (
  id     integer primary key check (id = 1),
  height integer not null
);
