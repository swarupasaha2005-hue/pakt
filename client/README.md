# Pakt client

Next.js 16 (App Router), React 19, Tailwind CSS 4, bun. Talks to NEAR testnet through wallet-selector (Meteor, MyNearWallet, HERE, HOT) and to the Pakt backend for the feed, leaderboard, faucet and gas relayer.

## Run

```bash
bun install
bun dev          # http://localhost:3000
bun run build    # production build
bunx tsc --noEmit && bun run lint
```

## Config

| Env var | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | deployed Worker | Backend base URL (HTTP + WebSocket `/stream`) |
| `NEXT_PUBLIC_NETWORK` | `testnet` | NEAR network |
| `NEXT_PUBLIC_RPC_URL` | `rpc.testnet.fastnear.com` | Main NEAR RPC for chain reads |
| `NEXT_PUBLIC_RPC_BACKUP` | `near-testnet.drpc.org` | Used once when the main RPC errors or rate-limits |
| `NEXT_PUBLIC_SOCIAL` | `v1.social08.testnet` | NEAR Social contract for invites by account name |
| `NEXT_PUBLIC_SITE_URL` | `paktdotfam.vercel.app` | Absolute URLs for share cards, sitemap and canonical links |

Contract ids (factory, tokens, oracle, Ref, Sputnik) live in `src/lib/config.ts`.

## Layout

| Path | Contents |
|---|---|
| `src/app/` | Routes: `/` explore, `/pakt/[id]`, `/u/[account]`, `/token/[symbol]`, `/privacy`, `/terms` |
| `src/components/shell/` | Top bar, account menu, create/deposit pill with faucet, how-it-works diagram |
| `src/components/left/` | Sidebar: feed, leaderboard, pakts, tokens, positions |
| `src/components/home/` | Explore tables (pakts, positions, tokens) |
| `src/components/pakt/` | Pakt page cards: trade panel, votes, settlement, recovery, offer |
| `src/components/modals/` | Create, deposit, leave, vote, hire, propose trader |
| `src/lib/near/` | Wallet provider, contract views and tx builders |
| `src/lib/pakt/`, `src/lib/profile/` | Page loaders, recovery checks, cost basis (with `*.check.ts` self-tests) |

## Deploy

Vercel, root directory `client`, bun. Vercel Analytics is on. Add the deployed origin to the backend `CORS_ORIGINS`.
