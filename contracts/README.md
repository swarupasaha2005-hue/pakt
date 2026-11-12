# contracts

- `factory/`: creates `<name>.<factory>` pakts, deploys `vault`, lists them.
- `vault/`: one per pakt. Holds funds + shares, enforces trader rules, settles fees. Owner = pakt's Sputnik DAO.
- `mocks/`: testnet dex + NEP-141 tokens.
- `deployments/`: contract IDs per network.
