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

build-contracts: ## build vault, factory, mock ft wasm into contracts/res
	./scripts/build-contracts.sh

e2e: ## build wasm + run local sandbox e2e (real oracle + sputnik)
	bash scripts/build-contracts.sh && cd contracts && cargo test -p pakt-e2e -- --nocapture
