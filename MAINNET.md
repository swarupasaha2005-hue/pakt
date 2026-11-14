# Mainnet plan

Pakt runs on NEAR testnet. Nothing is on mainnet yet. Full discussion: [issue #9](https://github.com/swarupasaha2005-hue/pakt/issues/9).

## Accounts

| Role | Account | Notes |
|---|---|---|
| Owner | new `<owner>.near` | Hardware key. Only `set_config` and upgrades. Never in the backend. |
| Factory | `factory.<owner>.near` | Holds the vault code. Pakts are `<name>.factory.<owner>.near`. |
| Platform fees | `fees.<owner>.near` | Own key, separate from the owner. |
| Gas relayer | `relay.<owner>.near` | The only key in the Worker. Small capped float. |

No faucet on mainnet.

## Config

| Field | Mainnet |
|---|---|
| `sputnik_factory` | `sputnik-dao.near` |
| `dex` | `v2.ref-finance.near` |
| `tokens` | native USDC, wBTC, wNEAR (`wrap.near`); check ids and pool depth first |
| `base_tokens` | native USDC |
| `settle_period_ms` | 7 days |
| `trade_delay_ms` | 24h or more |

## Oracle (the blocker)

`priceoracle.near` has been stale since March 2026, and the testnet reporter is one key we control.

Plan: a small adapter that reads Pyth on NEAR and serves the same `get_price_data` the vault calls. It rejects stale or wide-confidence prices. No team key on the price path, no vault changes.

## Cost

| Item | NEAR |
|---|---|
| Factory deploy | ~6 |
| Owner, fees, relayer accounts | ~1 |
| Relayer float | 5–10 |
| Per pakt, paid by its creator | ~12.65 |

## Launch checklist

1. `deploy-mainnet.sh`: dry run by default, no mocks, pools or faucet.
2. Reproducible wasm builds, hashes published in the README.
3. Deploy the oracle adapter; run `make e2e` against it.
4. Deploy the factory; check every id in `get_config`.
5. Backend: mainnet env, fresh D1, relayer key as a secret, faucet off.
6. Client: mainnet network, token list, testnet labels removed.
7. $10 smoke test: create, deposit, hire, trade, settle, fire, leave.
8. Per-pakt deposit cap until an external audit.

## Trezu

Every mainnet pakt gets a stock Sputnik DAO on `sputnik-dao.near`, and Trezu is a treasury app built on Sputnik DAO. Pakt's own flow stays the same; Trezu adds a second place to run the DAO.

1. Confirm with the Trezu team how a DAO created by a contract (our factory) is added to Trezu.
2. Add a **Manage in Trezu** button on the pakt page that opens that pakt's DAO.
3. Members see the DAO's proposals and vote there too: hire, set caps, resume, fire.
4. Optional: a pakt can keep its DAO's own NEAR and tokens in Trezu as the group's side treasury, separate from the vault.

## After launch

- Share-weighted DAO votes.
- Deploy the vault as a NEP-591 global contract to cut the per-pakt code cost.
