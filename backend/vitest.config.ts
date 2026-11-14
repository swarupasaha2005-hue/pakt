import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => ({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, "migrations")),
          NEARDATA_URL: "http://127.0.0.1:1", // the booted indexer must not reach the network in tests
          CORS_ORIGINS: "http://localhost:3000",
          PAKT_FACTORY: "pakt.testnet", // fixtures use this, not the deployed factory
          PRICE_MAP: "",
          PRICE_ORACLE: "",
          MIN_HEIGHT: "0", // fixtures index from low heights
        },
      },
    }),
  ],
  test: { setupFiles: ["./test/setup.ts"] },
}));
