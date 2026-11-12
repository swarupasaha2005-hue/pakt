import type { Token } from "./types";

export const tokens: Token[] = [
  { symbol: "NEAR", name: "Near Protocol", price: 5.42, change24h: -0.52, volume24h: 12_400_000, mcap: 6_610_000_000, holders: 8_412, allowed: true, logo: "/tokens/near.jpg", color: "#00c08b", glyph: "N" },
  { symbol: "wBTC", name: "Wrapped Bitcoin", price: 73_442, change24h: -0.32, volume24h: 2_440_000_000, mcap: 1_450_000_000_000, holders: 15_120, allowed: true, logo: "/tokens/wbtc.svg", color: "#f7931a", glyph: "₿" },
  { symbol: "ETH", name: "Ether", price: 2_045, change24h: 0.03, volume24h: 650_300_000, mcap: 246_800_000_000, holders: 12_903, allowed: true, logo: "/tokens/eth.png", color: "#627eea", glyph: "Ξ" },
  { symbol: "USDC", name: "USD Coin", price: 1, change24h: 0, volume24h: 88_100_000, mcap: 75_200_000_000, holders: 31_804, allowed: true, logo: "/tokens/usdc.svg", color: "#2775ca", glyph: "$" },
  { symbol: "USDT", name: "Tether", price: 1, change24h: 0.01, volume24h: 61_700_000, mcap: 142_000_000_000, holders: 27_410, allowed: false, logo: "/tokens/usdt.svg", color: "#26a17b", glyph: "₮" },
  { symbol: "AURORA", name: "Aurora", price: 0.0912, change24h: 7.33, volume24h: 4_120_000, mcap: 48_900_000, holders: 3_204, allowed: true, logo: "/tokens/aurora.svg", color: "#70d44b", glyph: "A" },
  { symbol: "REF", name: "Ref Finance", price: 0.1364, change24h: -2.35, volume24h: 1_870_000, mcap: 12_300_000, holders: 2_118, allowed: false, logo: "/tokens/ref.svg", color: "#00c6a2", glyph: "R" },
  { symbol: "BLACKDRAGON", name: "Black Dragon", price: 0.0000000171, change24h: 24.31, volume24h: 2_960_000, mcap: 15_900_000, holders: 5_661, allowed: false, logo: "/tokens/blackdragon.jpg", color: "#e0415b", glyph: "D" },
  { symbol: "LONK", name: "Lonk", price: 0.0000074, change24h: -8.3, volume24h: 980_000, mcap: 7_440_000, holders: 4_270, allowed: false, logo: "/tokens/lonk.png", color: "#c48a2c", glyph: "L" },
];
