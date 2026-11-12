# Mock map

What replaces each `lib/mock/*` import. Real sources:

- **API**: `lib/api.ts` (backend indexer; `useStream` in `lib/stream.ts` for live events)
- **chain**: `lib/near/contracts.ts` views (RPC) and tx builders, signed through `useWallet().signAndSend` (`lib/near/wallet.tsx`)
- **config**: `lib/config.ts` (`TOKENS`, `BASE_TOKEN`, `FACTORY`, ...)

Units: amounts are raw u128 strings. Value, budget, profit and pnl are usd e6 strings. `fee_bps`/`stop_loss_bps` are bps, but the mocks use percent.

## Pakt identity

Mocks key pakts by a short `id` ("degens"). On chain a pakt is its vault account `<name>.pakt.pakt-0mxhjh.testnet` with DAO `<name>.sputnikv2.testnet`. Route `/pakt/[id]` should take the name: `vaultId(name)` / `daoId(name)` in config.ts build the account ids. `generateStaticParams` cannot list pakts from mocks any more. Either drop it, or return a single placeholder and render dynamically under Suspense (cacheComponents is on).

## Per mock module

| mock | imported by | real source | notes |
|---|---|---|---|
| `types.Pakt` | PaktView, PaktHeader, MembersTable, TraderCard, OfferCard, PaktCard, ProposeTraderModal, VoteModal, ActivityCard, ProfileView, trade.ts | API `pakt(vault)` (name, dao, creator, join_mode) + chain `getState(vault)` (trader, budget/max_per_trade/budget_used, fee_bps, stop_loss_bps, paused, offer, total_shares, members, join_mode) + `getHolders(vault)` (members, shares) + `getPrices` → `vaultValue`/`sharesValue` | Swap the type for a view model built from those. `pnl7d`/`pnl7dPct` come from leaderboard `pakts` with `range=7d` (`change` is a fraction). `paused` = `state.trader?.paused`. |
| `pakts` | app/pakt/[id], app/u/[account], PaktsTable, Positions, TokenRow, PaktGrid, LeaderboardTab, PaktsTab, StarredTab, DepositModal, HoldersTable, TradePanel | API `pakts()` (list) / `pakt(vault)`. Chain `listPakts()` also works but includes in-flight pakts | Each list row's value or trader needs one `getState` per vault. Fine at testnet scale. |
| `types.Member` | (via Pakt) | chain `getHolders(vault)` → `[account, {shares, member, joined_ms}]` | `member:false` = fee-only holder (trader or platform). |
| `types.FeedEvent`, `FeedKind`, `feed` | FeedTab, FeedRow, TradesList, PaktView, ActivityCard, ProfileView, app/u/[account] | API `feed({kind})`, `paktFeed(vault)`, `accountFeed(account)` + `useStream` | Kind map: buy/sell → `trade`, picking the side by whether `token_in` is the base token. vote → no event (DAO proposals are not indexed; read `getProposals`). hired/fired/settled → same names. joined → `deposit` (first one) / `member_synced added:true`. left → `leave`. stoploss → `paused` (reason `stop_loss`). Extra kinds: `offer`, `declined`, `cap_set`, `resumed`, `fire_pending`, `claim`. `secondsAgo` = now − `ts_ms`. `detail` is built from `data`. |
| `trades` (`Trade`, `trades`, `flow`) | Chart, ChartPanel, HoldersTable, AboutCard | API `feed({kind:"trade"})` filtered by token | Only pakt trades exist; there is no market-wide tape. `flow` (buy/sell pressure) is derivable from the same trades, but the numbers are tiny. |
| `alerts` | AlertsTab, AlertCard | API `alerts({window})` | Shape differs: `{token, side, traders[], count, total_value, first_at, last_at}`. |
| `traders` / `types.Trader` | LeaderboardTab, TraderRow, ProposeTraderModal | API `leaderboard({range})`.traders + `trader(account)` | `askingFee`/`openToHire` have no source (profile data). ProposeTraderModal should take any account id plus terms. Range map: 24H → none (use 7d), 7D → `7d`, 30D → `30d`, ALL → `all`. |
| `offers` / `Offer` | PaktView, OfferCard | chain `getState(vault).offer` → `{terms: Trader, expires_ms}` | One offer per vault at most. Actions: `acceptOffer`, `declineOffer`. |
| `votes` (`Vote`, `NewVote`, `VoteStatus`) | PaktView, OpenVotesCard, VotesList, ProposeTraderModal, VoteModal | chain `getProposals(dao)` + `proposalCall(p)` to read method/args. Tx: `proposeTrader` / `proposeFire` / `proposeCap` / `proposeResume`, `vote(dao, proposal, "VoteApprove" \| "VoteReject")` | VoteKind map: hire → `offer_trader`, raise → `set_cap`, fire → `fire`, resume → `resume`. Status map: InProgress → Open, Approved → Passed, Rejected/Removed/Failed → Rejected, Expired → Expired. Hide `AddMemberToRole`/`RemoveMemberFromRole` (vault member syncs). Threshold is 1/2 of the members role (`getPolicy`, `daoMembers`). |
| `settlements` / `Settlement` | PaktView, SettlementsTable | API `paktFeed(vault)` kind `settled` (`share_price`, `hwm`, `profit`, fee shares) | No date string: format `ts_ms`. |
| `history` | pakt/ValueChart | API `paktFeed(vault)`: share price from `settled.share_price` and `deposit` value·1e12/shares | Sparse (one point per deposit or settle). Recommend: a step line, or drop the chart for a "share price now vs hwm" stat. |
| `me` | FeedTab, TraderRow, YourRank, LeaderboardTab, PaktsTab, DepositModal, PaktView, ProfileView, AccountPill, CashPill, ChartPanel, TradePanel | `useWallet().accountId`. cash = chain `ftBalanceOf(BASE_TOKEN.id, account)`. paktIds = vaults where `getHolder(vault, account)` is non-null (or vaults with the account's `deposit` events in `accountFeed`). total = cash + Σ `sharesValue` | `name` → account id. `change24h` → no source: remove. |
| `holdings` / `Holding` | app/u/[account], ProfileView, PositionsCard | Per vault the user holds: `getHolder` shares × `vaultValue/total_shares`. Token split = `state.balances` pro rata | `pnl`/`pnlPct` per holding need a cost basis: Σ deposit `value` − leave value from `accountFeed`. Solo vault (`owner` = account) → remove (no solo trading). |
| `positions` / `Position` | Positions, TradePanel | For a trader: `state.balances` of the vaults they trade for | `avgEntry` → no source. Solo positions (`paktId: null`) → remove. |
| `tokens` / `types.Token` | app/token/[symbol], PinStrip, Positions, TokensTable, AlertsTab, StarredTab, TokensTab, DepositModal, LeavePaktModal, PositionsCard, Ticker | config `TOKENS` (id, symbol, decimals, ref pool) + chain `getPrices(ids)` (usd = multiplier/10^decimals per raw unit) | `change24h`, `volume24h`, `mcap`, `holders` have no source: remove. `allowed` = in factory `tokens` (all of TOKENS). Logo/color: keep a small static map by symbol. Only tUSDC, tBTC and tNEAR exist. |
| `timeframes` (`changeIn`, `volumeIn`, `TIMEFRAMES`) | TokensTable, TokenRow, AboutCard | none | Remove (fake math on fake 24h change). |
| `candles` (`candles`, `RANGES`, `NOW`) | Chart, ChartPanel | none | Remove. No OHLC source. Optionally plot the trade events (above) as points, or the oracle price only. |
| `holders` (`holders`, `topPakt`, `pickPakt`) | HoldersTable, TokenRow | partial: pakts holding the token = `getState(vault).balances` over all pakts | Recommend: replace with "Pakts holding X" (vault, amount, value) or remove. No per-wallet holder list. |
| `following` | ChartPanel, HoldersTable | none | Remove (no social graph). |
| `stars` | StarredTab | none on chain | Keep as localStorage (per-browser convenience) or remove the tab. |
| `profiles` (`Profile`, `valueSeries`, `TraderRecord`) | app/u/[account], ProfileView, ProfileHeader, EditProfileModal, OnboardModal, profile/ValueChart | partial: API `trader(account)` (pnl, volume, trades, live, per-pakt tenures) + `accountFeed(account)` | bio/x/telegram/avatar/cover/openToHire/askingFee/followers/following/joined/avgHold/winRate/maxDrawdown have no source. Remove EditProfileModal + OnboardModal (no profile store). `valueSeries` → remove the chart. Keep the trader record card from `trader()`. |
| `recap` | RecapCard | none | Remove. |
| `rng` | internal to mocks | — | Goes with the mocks. |

## Screens / components with no real source

Remove:
- `token/Chart`, the candle range picker in `token/ChartPanel` (no OHLC data)
- `home/TokensTable` columns for change/volume/mcap/holders, plus timeframe selector
- `token/HoldersTable` (or turn it into "pakts holding X")
- `left/feed/RecapCard`
- `profile/ValueChart`, `modals/EditProfileModal`, `profile/OnboardModal`
- Follow buttons / following filters (ChartPanel, HoldersTable)
- Solo trading in `token/TradePanel`: users never trade on their own. Keep the panel only for an account that is a pakt's live trader (`trade` builder, pool from `TOKENS[].pool`, caps from `state.trader`).
- `AccountPill` 24h change; `CashPill` total change

Simplify:
- `pakt/ValueChart` → share-price steps from feed, or a stat
- `left/StarredTab` → localStorage
- `home/PinStrip`, `shell/Ticker` → 3 tokens at oracle prices
- `left/TokensTab` → 3 tokens
- `home/MarketTable`/`PaktsTable` → pakts from `pakts()` + `getState`

Kept, with real data: Feed, Alerts, Leaderboard (traders + pakts), Pakts tab, Pakt page (header, members, trader, offer, votes, trades, settlements, share card), Deposit/Leave/CreatePakt/ProposeTrader/Vote modals, profile header/activity/positions (trimmed).

Missing flows (exist on chain, no UI yet): create pakt (`createPakt`; needs a `requiredDeposit(whitelist.length)` read first), invite links (Invite mode needs an ed25519 keypair client side; joiners pass `{"invite_sig": hex}` as the deposit msg), settle button (`settle`, anyone, after the period), claim owed payouts (`getOwed` + `claim`).

## Routes

| route | keep? | notes |
|---|---|---|
| `/` (Discover) | keep | Pakts list + 3 tokens. Drop the market-wide token stats. |
| `/pakt/[id]` | keep | id = pakt name → `vaultId`/`daoId`. Remove mock `generateStaticParams`; render dynamically under Suspense. |
| `/u/[account]` | keep, slimmed | Account feed, holdings, trader record. No profile fields. Remove mock `generateStaticParams`. |
| `/token/[symbol]` | simplify or remove | Only 3 test tokens, no chart data. Recommend: remove it and link tokens to nothing. Or keep a minimal page: oracle price, pakts holding it, recent pakt trades. |
