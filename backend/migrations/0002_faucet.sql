-- faucet claims, for the per-account and per-ip daily limits
CREATE TABLE faucet_claims (account TEXT NOT NULL, ip TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX faucet_claims_account ON faucet_claims (account, at);
CREATE INDEX faucet_claims_ip ON faucet_claims (ip, at);
