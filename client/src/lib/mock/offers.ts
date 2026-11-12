export type Offer = { paktId: string; to: string; budget: number; maxPerTrade: number; stopLoss: number; fee: number };

// moonboys passed "Hire nova.near" (votes.ts v4), waiting on nova to sign
export const offers: Offer[] = [{ paktId: "moonboys", to: "nova.near", budget: 500, maxPerTrade: 50, stopLoss: 30, fee: 20 }];
