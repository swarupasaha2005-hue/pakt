-- fresh cursor row: a stale indexer still writing the old `cursor` table can't drag this one back
create table index_cursor (
  id     integer primary key check (id = 1),
  height integer not null
);
