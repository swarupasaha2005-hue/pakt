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
