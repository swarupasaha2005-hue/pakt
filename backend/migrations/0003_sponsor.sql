-- gas-sponsored meta txs per sender, for the free-tx cap
CREATE TABLE sponsored (account TEXT PRIMARY KEY, n INTEGER NOT NULL);
-- one gas top-up per account, for wallets that can't sign delegate actions
CREATE TABLE gas_topups (account TEXT PRIMARY KEY, ip TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX gas_topups_ip_at ON gas_topups (ip, at);
