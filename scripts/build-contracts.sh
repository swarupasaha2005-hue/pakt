#!/usr/bin/env bash
# Builds contract wasm into contracts/res. Vault first: factory include_bytes! it.
set -euo pipefail
cd "$(dirname "$0")/../contracts"
mkdir -p res; RES="$PWD/res"
for p in pakt-vault pakt-factory pakt-mock-ft; do
  if command -v cargo-near >/dev/null; then
    dir=$(cargo metadata --no-deps --format-version 1 | jq -r ".packages[]|select(.name==\"$p\").manifest_path" | xargs dirname)
    (cd "$dir" && cargo near build non-reproducible-wasm --no-abi --out-dir "$RES")
  else
    # near-sdk wires host fns only under cfg near; mvp cpu keeps out wasm features the NEAR VM rejects
    RUSTFLAGS="--cfg near -C target-cpu=mvp" cargo build -p "$p" --target wasm32-unknown-unknown --release
    cp "target/wasm32-unknown-unknown/release/${p//-/_}.wasm" res/
  fi
  if command -v wasm-opt >/dev/null; then wasm-opt -Oz "res/${p//-/_}.wasm" -o "res/${p//-/_}.wasm"; fi
done
ls -l res
