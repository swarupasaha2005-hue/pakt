import type { Trader } from "./types";

export const traders: Trader[] = [
  { account: "alice.near", name: "Alice", askingFee: 20, pnl: { "24H": 1_240, "7D": 10_783, "30D": 31_920, ALL: 88_410 }, openToHire: true },
  { account: "bob.near", name: "Bob", askingFee: 15, pnl: { "24H": 860, "7D": 9_653, "30D": 22_140, ALL: 54_900 }, openToHire: true },
  { account: "carol.near", name: "Carol", askingFee: 25, pnl: { "24H": -310, "7D": 7_204, "30D": 18_770, ALL: 47_320 }, openToHire: true },
  { account: "dave.near", name: "Dave", askingFee: 10, pnl: { "24H": 420, "7D": 5_118, "30D": 9_660, ALL: 15_200 }, openToHire: false },
  { account: "erin.near", name: "Erin", askingFee: 30, pnl: { "24H": 2_015, "7D": 4_890, "30D": 26_400, ALL: 61_050 }, openToHire: true },
  { account: "frank.near", name: "Frank", askingFee: 20, pnl: { "24H": -95, "7D": 2_310, "30D": -1_420, ALL: 6_880 }, openToHire: false },
  { account: "grace.near", name: "Grace", askingFee: 15, pnl: { "24H": 130, "7D": 1_744, "30D": 5_230, ALL: 12_610 }, openToHire: true },
  { account: "heidi.near", name: "Heidi", askingFee: 20, pnl: { "24H": -640, "7D": -1_080, "30D": 3_390, ALL: 9_970 }, openToHire: false },
  { account: "ivan.near", name: "Ivan", askingFee: 25, pnl: { "24H": 55, "7D": -2_460, "30D": -4_100, ALL: -1_330 }, openToHire: true },
];
