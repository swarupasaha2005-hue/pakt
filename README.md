# Pakt

A group trading vault on NEAR: friends pool tokens in a vault, vote one person in as trader, and the trader can swap the pool but can never withdraw it.

**Problem.** Friend groups, Discord/Telegram groups and investment clubs often pool money with the one person who trades well. Today that means "send money and hope": the trader holds everything and the others have no control if the trader loses it, steals it or disappears. Pakt keeps the money in a contract that only lets the trader swap between allowed tokens within voted limits, and only lets members take money out.

## How it works

1. **Create.** Anyone calls `create_pakt` on the factory (name, token allowlist, stop-loss, open or invite-only, minimum deposit). The factory creates a Sputnik DAO `<name>.<sputnik>` and the vault `<name>.<factory>`, and registers the vault on every allowed token and on Ref.
2. **Register.** Before the first deposit, each member calls `storage_deposit` on the vault (0.01 NEAR, refunded by `storage_unregister` after leaving). It pays for their own storage and DAO sync, so churn can't drain the vault. They also register on the pakt's tokens so payouts arrive (else parked for `claim`).
3. **Deposit.** A member calls `ft_transfer_call` on the base token (e.g. USDC) with the vault as receiver. The vault's `ft_on_transfer` prices the vault through the oracle, mints shares at the current share price, and adds the depositor to the DAO `members` role. Invite-only pakts need an ed25519 invite signature in `msg`.
4. **Vote a trader.** Members put a Sputnik function-call proposal to the vault's `offer_trader` (account, budget, max per trade, fee 10-30%, stop-loss). A majority vote passes it.
5. **Accept.** The chosen account calls `accept_offer` (or `decline_offer`) within 3 days. Trading opens after the trade delay.
6. **Trade.** The trader calls `trade` (pool id, token in, token out, amount, min out). The vault swaps on Ref (Rhea): deposit to Ref, `swap`, withdraw back, checking caps, the oracle floor and the slippage budget.
7. **Settle.** Anyone calls `settle` once per settle period. Profit above the high-water mark pays the trader fee and the 1% platform fee as newly minted shares.
8. **Fire, leave, claim.** The DAO votes `fire` (if the vault is busy the trader is paused and anyone runs `finish_fire`). A member calls `leave(shares)` and gets a pro-rata slice of every token, in kind. A failed payout is retried with `claim(token)`.

## How NEAR is used

| NEAR feature | Use in Pakt |
|---|---|
| Sputnik DAO | One DAO per pakt. Members vote on `offer_trader`, `set_cap`, `resume`, `fire`. The vault keeps the `members` role equal to depositors through its own `vault` role (`add_member_to_role` / `remove_member_from_role`); retries via `sync_member`. See `contracts/vault/src/dao.rs`, `contracts/factory/src/policy.rs`. |
| Named sub-accounts | Each vault is `<name>.<factory>`, e.g. `moon-club.pakt.testnet`. See `contracts/factory/src/name.rs`. |
| NEP-141 tokens | Deposits through `ft_transfer_call`, payouts through `ft_transfer`. Only allowlisted tokens. |
| Account with no access keys | The factory creates, funds, deploys and inits the vault in one batch and adds no key, so the vault code cannot be changed. |
| Ref (Rhea) exchange | All trades are Ref `swap` actions (`ref-finance-101.testnet`, `v2.ref-finance.near`). See `contracts/vault/src/trade.rs`. |
| Price oracle | NearDeFi price-oracle `get_price_data` values the vault for shares, fees, caps and the swap floor. See `contracts/vault/src/oracle.rs`. |
| NEP-297 events | Factory and vault log `EVENT_JSON` (`standard: "pakt"`). The backend indexes them for the feed and leaderboard. |

## Security guarantees

| Guarantee | How it is enforced |
|---|---|
| The trader can never withdraw | No vault method sends tokens to the trader. `trade` only moves tokens to and from the Ref account; `leave` pays only the caller's own shares. The trader's fee is paid as shares, the same as any holder. |
| Token allowlist | Factory `config.tokens` / `base_tokens` limit what a pakt may hold; vault `token_index` rejects any other token. Non-base deposits are refunded. |
| Every swap has an oracle price floor (2%) | `min_amount_out` is raised to oracle price minus `MAX_SLIPPAGE_BPS = 200` (`trade.rs`). |
| 3% slippage budget per 24h | Realized loss vs oracle is summed in `slip_used`; a trade is refused past `MAX_PERIOD_SLIP_BPS = 300` of vault value. Resets on a rolling 24h window (`slip_since_ms`), independent of the settle period. |
| Trade delay after hire or cap raise | `trade_after_ms` is set on `accept_offer` and pushed forward by a `set_cap` that adds spend room, so members can leave first (minimum 60 s, `trade_delay_ms`). |
| Per-trade cap and total budget | `within_caps` checks `max_per_trade` and `budget` in USD. |
| Stop-loss pause | `check_stop_loss` pauses the trader when share price drops `stop_loss_bps` below the mark; only a DAO `resume` restarts trading. |
| Fees only above the high-water mark | `crystallize` charges fees only on share-price gain above `hwm`, and runs before every deposit, leave and fire, so new money never pays for old profit and leaving never dodges fees. |
| $5 minimum deposit | `on_deposit` refunds anything worth under $5 at oracle price (`MIN_DEPOSIT_USD_E6`), plus a per-pakt `min_deposit`, so dust accounts can't flood the vote. |
| Internal ledger | Balances live in `balances` / `at_dex`, never read from `ft_balance_of`, so tokens sent directly (donations) can't move the share price. |
| Concurrency and stale-lock unlock | Trade, accept, fire and recover hold an exclusive lock (`op`); deposits, leaves and settles run as counted flows, so deposit spam can't block leaving. A lock or flow older than 10 min is cleared by anyone with `unlock`. Callbacks carry `op_id` / `flow_gen`, so a stale callback is ignored (a stale deposit is refunded). |
| DAO name squatting | The factory puts a random nonce in the DAO metadata and checks it in `on_dao_check`; a squatted `<name>.<sputnik>` aborts and refunds. |
| Backend hardening | Per-IP rate limits (60/min API, 10/min stream), validated account ids and query params, only events emitted by the factory or a direct `<name>.<factory>` vault are indexed (`trusted` in `backend/src/chain.ts`), GET-only plus a token-guarded `POST /admin/start`. |

Two independent security audits were run on the contracts and backend; their findings were fixed and have regression tests (`contracts/vault/src/audit_tests.rs`, `contracts/vault/src/review_tests.rs`, `contracts/e2e/tests/audit.rs`).

**Known limits**

- Deposit and leave use the oracle price, which lags the market; a member who sees a move before the oracle can enter or exit at the stale price.
- Fees are marked at whatever price the oracle reports at deposit/leave/settle; a short price spike can crystallize a fee that the price then gives back.
- A DAO majority can use function-call proposals to spend the DAO account's own small NEAR balance (not the vault's tokens).
- Testnet Ref pools drift from the oracle price; re-centre them with `scripts/deploy-testnet.sh --reseed` or trades hit the 2% floor.
- A mainnet oracle is still to be chosen: `priceoracle.near` has been stale since March 2026.

## Quickstart for judges

Prerequisites: Rust with the `wasm32-unknown-unknown` target (`rustup target add wasm32-unknown-unknown`), bun, near-cli-rs (deploy only), jq, python3. `cargo-near` and `wasm-opt` are used when present. All commands run from the repo root. `make help` lists targets.

| Do | See |
|---|---|
| `make build-contracts` | `contracts/res/` lists `pakt_vault.wasm`, `pakt_factory.wasm`, `pakt_mock_ft.wasm`. |
| `cd contracts && cargo test` | Unit tests for vault, factory and mock token: `67 passed` for vault, `19 passed` (plus 1 sandbox) for factory, `4 passed` for the mock, `0 failed`. |
| `make e2e` | Builds wasm, starts a local NEAR sandbox with the real Sputnik DAO, NearDeFi price-oracle and Ref exchange wasm (`contracts/res/external/`), runs `contracts/e2e/tests`. Expect `test result: ok. 16 passed` for `scenarios` and `3 passed` for `audit` and `1 passed` for `gas` (8-token create + full leave fit 300 TGas). |
| `make smoke` | ~1 min. Sandbox + local Worker: one pakt, one deposit. Prints `smoke: <event kinds>` from `/feed`, including `pakt_created` and `deposit`. |
| `make stack-e2e` | Sandbox runs one pakt through every event kind; the local Worker indexes it; checks HTTP routes, WebSocket push and restart catch-up. Ends with `STACK E2E PASS`. |
| `make backend-test` | `tsc --noEmit` clean, then vitest in workerd: `Tests 62 passed`. |
| `make client` | Next.js dev server; open http://localhost:3000. |

`make e2e` proves, on the sandbox:

- happy path: create, deposit, hire, settle with fees;
- leave pays in kind after fees and removes the DAO member;
- a loss then recovery charges no fee; a deposit above the mark pays no old profit;
- access control: only the DAO, the offered trader, or the trader can call their methods;
- factory rejects tokens outside its allowlist; invite-only needs a valid invite signature;
- deposits and leaves overlap without blocking each other; a failed payout is owed, then claimed;
- `fire` pays profit-only fees and still works with the oracle down;
- trades: happy path, refused below the oracle floor, per-trade and budget caps, stop-loss pause then DAO `resume`;
- a failed Ref withdraw parks funds, then `dex_recover` brings them home;
- a failed member sync is retried with `sync_member`;
- audit regressions: low-NEAR vault refuses deposits but never locks; a sybil majority that hires itself waits out the trade delay and loses under 3%; member sync pays the DAO's storage.

## Testnet deployment

`scripts/deploy-testnet.sh` deploys the oracle, three mock tokens at mainnet decimals (tUSDC 6, tBTC 8, tNEAR 24), two Ref pools seeded at the live price, and the factory.

1. `make build-contracts`
2. `OWNER=<your testnet account> bash scripts/deploy-testnet.sh`: dry run. Prints every near-cli-rs command and a NEAR cost estimate; changes nothing.
3. Add `--execute` to run them. The script prints the Worker vars `PAKT_FACTORY`, `PRICE_ORACLE`, `PRICE_MAP`.
4. `bash scripts/deploy-testnet.sh --reseed --execute` re-centres the pools on the oracle price later.

Live demo: <URL>

Deployed accounts (testnet):

| Contract | Account | Explorer |
|---|---|---|
| Factory | `pakt.pakt-0mxhjh.testnet` | [nearblocks](https://testnet.nearblocks.io/address/pakt.pakt-0mxhjh.testnet) |
| Price oracle | `oracle.pakt-0mxhjh.testnet` | [nearblocks](https://testnet.nearblocks.io/address/oracle.pakt-0mxhjh.testnet) |
| tUSDC token | `tusdc.pakt-0mxhjh.testnet` | [nearblocks](https://testnet.nearblocks.io/address/tusdc.pakt-0mxhjh.testnet) |
| tBTC token | `tbtc.pakt-0mxhjh.testnet` | [nearblocks](https://testnet.nearblocks.io/address/tbtc.pakt-0mxhjh.testnet) |
| tNEAR token | `tnear.pakt-0mxhjh.testnet` | [nearblocks](https://testnet.nearblocks.io/address/tnear.pakt-0mxhjh.testnet) |
| Platform fees | `pakt-fees.testnet` | [nearblocks](https://testnet.nearblocks.io/address/pakt-fees.testnet) |
| Price reporter | `pakt-83p1jb.testnet` | [nearblocks](https://testnet.nearblocks.io/address/pakt-83p1jb.testnet) |
| Ref exchange | `ref-finance-101.testnet` | [nearblocks](https://testnet.nearblocks.io/address/ref-finance-101.testnet) |
| Sputnik DAO factory | `sputnikv2.testnet` | [nearblocks](https://testnet.nearblocks.io/address/sputnikv2.testnet) |
| Ref pools | tUSDC/tBTC `2958`, tUSDC/tNEAR `2959` | [tBTC pool](https://testnet.app.ref.finance/pool/2958), [tNEAR pool](https://testnet.app.ref.finance/pool/2959) |
| Backend Worker | `https://pakt-backend.debanjanspider5.workers.dev` | [/healthz](https://pakt-backend.debanjanspider5.workers.dev/healthz) |

## Architecture

```
  client (Next.js)                                     backend (Cloudflare Worker)
       |                                                +-------------------------------+
       | sign txs                                       | Indexer Durable Object        |
       v                                                |   polls neardata / RPC        |
    wallet                                              |   keeps trusted pakt events   |
       |                                                |   -> D1 (feed, pakts, stats)  |
       +--> factory  create_pakt                        |   -> WebSocket /stream        |
       +--> vault    deposit, trade, settle, leave ... -+-> NEP-297 EVENT_JSON logs ---->|
       +--> Sputnik DAO  proposals + votes              | HTTP API: /feed /pakts        |
                |                                       |   /leaderboard /alerts        |
                +--> vault  offer_trader, fire ...      | cron (1 min): price relay     |
       vault --> Ref (Rhea)  swap                       |   Pyth Hermes, CoinGecko      |
       vault --> price oracle  get_price_data  <--------+   fallback -> report_prices   |
                                                        +---------------+---------------+
  client <------------- HTTP + WebSocket ---------------------------------+
```

## Repo layout

| Path | Contents |
|---|---|
| `contracts/vault/` | Vault contract: shares, trader rules, Ref swaps, settle and fees, DAO member sync, events |
| `contracts/factory/` | Factory: `create_pakt`, DAO policy, name rules, registry |
| `contracts/mocks/ft/` | NEP-141 mock token for sandbox and testnet |
| `contracts/e2e/` | near-workspaces sandbox tests and the `stack` binary used by the backend stack test |
| `contracts/res/` | Built wasm; `res/external/` holds the Sputnik, price-oracle and Ref wasm |
| `contracts/deployments/` | Contract ids per network |
| `backend/` | Cloudflare Worker: indexer, read API, WebSocket stream, price relay, D1 migrations, vitest tests, `scripts/stack-e2e.ts` |
| `client/` | Next.js app |
| `landing/` | Landing page |
| `scripts/` | `build-contracts.sh`, `deploy-testnet.sh` |
| `Makefile` | All targets above |

## Hackathon tracks

- **social** (main): shared money for a group on Sputnik DAO with named accounts. Members hire and fire a trader by vote instead of trusting one person with the funds.
- **defi**: a pooled trading vault with shares, high-water-mark fees, oracle pricing and Ref (Rhea) swaps.
- **security**: a spending-limited role. The trader gets trade rights but no withdraw, inside caps, an oracle floor, a slippage budget, a trade delay and a stop-loss.

## Libraries and third-party code

- [near-sdk](https://github.com/near/near-sdk-rs) and near-contract-standards (Rust contracts)
- [near-workspaces](https://github.com/near/near-workspaces-rs) (sandbox tests)
- [uint](https://crates.io/crates/uint) (256-bit math), [ed25519-dalek](https://crates.io/crates/ed25519-dalek) (invite signatures in tests)
- [Sputnik DAO v2](https://github.com/near-daos/sputnik-dao-contract) (DAO per pakt; factory wasm used in the sandbox)
- [NearDeFi price-oracle](https://github.com/NearDeFi/price-oracle) (wasm used in the sandbox and on testnet)
- [Ref exchange](https://github.com/ref-finance/ref-contracts) wasm (sandbox; Ref/Rhea on testnet and mainnet)
- Cloudflare Workers, D1, Durable Objects, wrangler; vitest with `@cloudflare/vitest-plugin`
- Next.js, React, Tailwind CSS, lightweight-charts (client)
- Price data: Pyth Hermes, CoinGecko

AI coding tools (Claude Code) were used to write and review code, tests and docs.

## License

MIT, see [LICENSE](LICENSE).
