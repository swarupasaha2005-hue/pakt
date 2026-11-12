// Public runtime config. NEXT_PUBLIC_* must be read literally so next can inline them.
export type Network = "testnet" | "mainnet";
/** ref pool id: the token against the base token; null for the base itself */
export type TokenInfo = { id: string; symbol: string; decimals: number; pool: number | null };

export const NETWORK = (process.env.NEXT_PUBLIC_NETWORK || "testnet") as Network;
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://pakt-backend.debanjanspider5.workers.dev";
export const WS_URL = API_URL.replace(/^http/, "ws") + "/stream";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.testnet.fastnear.com";
export const FACTORY = process.env.NEXT_PUBLIC_FACTORY || "pakt.pakt-0mxhjh.testnet";
export const ORACLE = process.env.NEXT_PUBLIC_ORACLE || "oracle.pakt-0mxhjh.testnet";
export const SPUTNIK = process.env.NEXT_PUBLIC_SPUTNIK || "sputnikv2.testnet";
export const DEX = process.env.NEXT_PUBLIC_DEX || "ref-finance-101.testnet";

/** "id:symbol:decimals[:pool]" comma list; first is the base (deposit) token */
const TOKENS_RAW =
  process.env.NEXT_PUBLIC_TOKENS ||
  "tusdc.pakt-0mxhjh.testnet:tUSDC:6,tbtc.pakt-0mxhjh.testnet:tBTC:8:2958,tnear.pakt-0mxhjh.testnet:tNEAR:24:2959";

export const TOKENS: TokenInfo[] = TOKENS_RAW.split(",").map((s) => {
  const [id, symbol, decimals, pool] = s.trim().split(":");
  return { id, symbol, decimals: Number(decimals), pool: pool ? Number(pool) : null };
});
export const BASE_TOKEN = TOKENS[0];
export const token = (id: string) => TOKENS.find((t) => t.id === id);

/** vault and dao ids for a pakt name, as the factory derives them */
export const vaultId = (name: string) => `${name}.${FACTORY}`;
export const daoId = (name: string) => `${name}.${SPUTNIK}`;
