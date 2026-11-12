export type Settlement = { paktId: string; date: string; profit: number; fee: number; hwm: number };

// last hwm per pakt = current high-water mark; slowcookers sits at its stop-loss
export const settlements: Settlement[] = [
  { paktId: "degens", date: "Nov 1", profit: 300, fee: 20, hwm: 5_500 },
  { paktId: "degens", date: "Nov 8", profit: 580, fee: 20, hwm: 6_080 },
  { paktId: "wagmi", date: "Nov 8", profit: 640, fee: 15, hwm: 14_200 },
  { paktId: "moonboys", date: "Nov 1", profit: 210, fee: 20, hwm: 1_410 },
  { paktId: "moonboys", date: "Nov 8", profit: -310, fee: 20, hwm: 1_410 },
  { paktId: "nightowls", date: "Nov 8", profit: 420, fee: 25, hwm: 9_000 },
  { paktId: "stackers", date: "Nov 8", profit: 900, fee: 30, hwm: 21_800 },
  { paktId: "slowcookers", date: "Nov 8", profit: 160, fee: 15, hwm: 3_390 },
];
