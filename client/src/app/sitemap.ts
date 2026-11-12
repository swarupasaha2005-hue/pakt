import type { MetadataRoute } from "next";
import { SITE, TOKENS } from "@/lib/config";
import { listPakts } from "@/lib/near/contracts";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // shortcut: first 200 pakts only, page through list_pakts if it grows past that
  const pakts = await listPakts(0, 200).catch(() => []);
  return [
    { url: SITE, changeFrequency: "hourly", priority: 1 },
    ...pakts.map((p) => ({ url: `${SITE}/pakt/${p.name}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...TOKENS.map((t) => ({ url: `${SITE}/token/${t.symbol.toLowerCase()}`, changeFrequency: "daily" as const, priority: 0.5 })),
    { url: `${SITE}/terms`, priority: 0.2 },
    { url: `${SITE}/privacy`, priority: 0.2 },
  ];
}
