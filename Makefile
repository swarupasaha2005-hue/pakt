SHELL := /bin/bash
.DEFAULT_GOAL := help

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "};{printf "  \033[36m%-10s\033[0m %s\n",$$1,$$2}'

contracts: ## build contracts to wasm
	cd contracts && cargo build --target wasm32-unknown-unknown --release

test: ## run contract tests
	cd contracts && cargo test

client: ## run client
	cd client && bun install && bun dev

backend: ## run the worker locally :8787 (wrangler dev, local D1 + DO; reads backend/.dev.vars)
	cd backend && bun install && bunx wrangler dev --test-scheduled

backend-migrate: ## apply D1 migrations to the local db
	cd backend && bun install && bunx wrangler d1 migrations apply pakt --local

backend-test: ## typecheck + vitest in workerd
	cd backend && bun install && bunx tsc --noEmit && bunx vitest run

# cargo workspace holding e2e/ and res/; override while contracts live in another checkout
CONTRACTS_DIR ?= $(CURDIR)/contracts

wasm: ## build contract wasm unless res/ is newer than every source
	@v=$(CONTRACTS_DIR)/res/pakt_vault.wasm; \
	if [ ! -f $$v ] || [ -n "$$(find $(CONTRACTS_DIR)/vault $(CONTRACTS_DIR)/factory $(CONTRACTS_DIR)/mocks \( -name '*.rs' -o -name Cargo.toml \) -newer $$v | head -1)" ]; \
	then bash $(CONTRACTS_DIR)/../scripts/build-contracts.sh; else echo "wasm up to date"; fi

stack-e2e: wasm ## sandbox + real contracts -> local worker; asserts every indexed event over http + ws
	cd backend && bun install && CONTRACTS_DIR=$(CONTRACTS_DIR) bun scripts/stack-e2e.ts

smoke: wasm ## ~1 min: one pakt + one deposit through the local worker
	cd backend && bun install && CONTRACTS_DIR=$(CONTRACTS_DIR) bun scripts/stack-e2e.ts --smoke

build-contracts: ## build vault, factory, mock ft wasm into contracts/res
	./scripts/build-contracts.sh

e2e: ## build wasm + run local sandbox e2e (real oracle + sputnik)
	bash scripts/build-contracts.sh && cd contracts && cargo test -p pakt-e2e -- --nocapture

.PHONY: contracts test client backend backend-migrate backend-test wasm stack-e2e smoke build-contracts e2e
