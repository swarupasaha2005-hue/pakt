# contracts

- `factory/`: creates `<name>.<factory>` pakts, deploys `vault`, lists them.
- `vault/`: one per pakt. Holds funds + shares, enforces trader rules, settles fees. Owner = pakt's Sputnik DAO.
- `mocks/`: NEP-141 test tokens. Trades go to the real Ref (Rhea) exchange; `res/external/` holds its wasm for the sandbox.
- `deployments/`: contract IDs per network.
