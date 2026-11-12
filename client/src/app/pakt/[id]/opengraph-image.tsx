import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { sprite } from "@/components/ui/PixelAvatar";
import { compact } from "@/lib/format";
import { getPakt, getPrices, getState, vaultValue } from "@/lib/near/contracts";

export const alt = "Join my pakt on Pakt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// "pakt" wordmark outlines (General Sans 700, same as app/icon.svg): satori can't load the navbar font
const MARK = { viewBox: "5.6 -71.8 203.1 91.1", d: ["M61.30-26.90L61.30-26.90Q61.30-15 54.65-7Q48 1 37.30 1L37.30 1Q29 1 22.70-5L22.70-5L22.70 19.30L5.60 19.30L5.60-53.80L21.30-53.80L21.30-47.70Q28.10-54.80 37.30-54.80L37.30-54.80Q48-54.80 54.65-46.75Q61.30-38.70 61.30-26.90ZM43.50-26.90L43.50-26.90Q43.50-32.90 40.45-36.15Q37.40-39.40 33.20-39.40L33.20-39.40Q28.90-39.40 25.90-36.10Q22.90-32.80 22.90-26.80L22.90-26.80Q22.90-20.70 25.90-17.55Q28.90-14.40 33.20-14.40Q37.50-14.40 40.50-17.60Q43.50-20.80 43.50-26.90ZM109.40 0L95.60 0L95.60-5.20Q90.10 1 80.20 1L80.20 1Q71.80 1 66.65-3.65Q61.50-8.30 61.50-15.90L61.50-15.90Q61.50-23.80 67.65-27.95Q73.80-32.10 85.40-32.10L85.40-32.10Q89.90-32.10 93.30-31.50L93.30-31.50L93.30-34.10Q93.30-37.60 91.35-39.50Q89.40-41.40 85.80-41.40L85.80-41.40Q78.60-41.40 77.70-34.10L77.70-34.10L62.30-34.10Q63.10-43.50 69.50-49.15Q75.90-54.80 85.90-54.80L85.90-54.80Q97-54.80 103.20-49.10Q109.40-43.40 109.40-33.20L109.40-33.20L109.40 0ZM77.60-16.40L77.60-16.40Q77.60-13.80 79.35-12.30Q81.10-10.80 84.20-10.80L84.20-10.80Q88.50-10.80 90.90-12.70Q93.30-14.60 93.30-17.90L93.30-17.90L93.30-21.30Q89.70-22 86.50-22L86.50-22Q77.60-22 77.60-16.40ZM132.20-24.50L132.20 0L115.10 0L115.10-71.80L132.20-71.80L132.20-32L148.90-53.80L168.60-53.80L148.70-28.30L171.40 0L149.60 0L132.20-24.50ZM208.30-16.80L208.30-16.80L208.30-1.90Q203.10 1 196.10 1L196.10 1Q187 1 181.95-4.15Q176.90-9.30 176.90-18.50L176.90-18.50L176.90-38.90L166.90-38.90L166.90-53.80L176.90-53.80L176.90-69.60L194-69.60L194-53.80L208.70-53.80L208.70-38.90L194-38.90L194-22.50Q194-14.90 200.90-14.90L200.90-14.90Q205.30-14.90 208.30-16.80Z"] };

// palette from globals.css; satori can't read css vars
const C = { page: "#0b1418", bg: "#0f1a1f", border: "#303030", text: "#f6fefd", text2: "#949e9c", accent: "#50d2c1" };

/** share card shown when a pakt link is posted on X or anywhere with og:image */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // any chain hiccup still renders a card, just without numbers
  const info = await getPakt(id).catch(() => null);
  const state = info ? await getState(info.vault).catch(() => null) : null;
  const prices = state ? await getPrices(state.balances.map(([t]) => t)).catch(() => null) : null;
  const value = state && prices ? vaultValue(state, prices) : null;
  const t = state?.trader;
  const usdc = `data:image/svg+xml;base64,${(await readFile(join(process.cwd(), "public/tokens/usdc.svg"))).toString("base64")}`;
  const near = `data:image/jpeg;base64,${(await readFile(join(process.cwd(), "public/tokens/near.jpg"))).toString("base64")}`;
  const fonts = await generalSans().catch(() => undefined);
  const name = info?.name ?? id;
  const av = sprite(name);
  const hsl = (c: string) => c.replace(/ /g, ", "); // satori wants comma hsl
  const stats: [string, string][] = [
    ["Members", state ? String(state.members) : "—"],
    ["Pakter", t ? t.account.split(".")[0] : "Hiring"],
    ["Pakter fee", t ? `${t.fee_bps / 100}% of profit` : "—"],
  ];

  // one panel like the site's cards: header, pakt, vault value, stat row, guarantees
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: C.page, padding: 32, fontFamily: "General Sans", color: C.text }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, background: C.bg, border: `2px solid ${C.border}`, borderRadius: 28, padding: "36px 44px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <svg viewBox={MARK.viewBox} height={40} width={89}>
              {MARK.d.map((d) => <path key={d} d={d} fill={C.text} />)}
            </svg>
            <span style={{ display: "flex", background: C.accent, color: "#04060c", borderRadius: 16, padding: "12px 26px", fontSize: 26, fontWeight: 500 }}>Join my pakt</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 44 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <svg viewBox={`0 0 ${av.grid} ${av.grid}`} width={112} height={112} style={{ borderRadius: 999 }}>
                <rect width={av.grid} height={av.grid} fill={hsl(av.bg)} />
                {av.cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={hsl(av.fg)} />)}
              </svg>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 80, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>{name}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8, color: C.text2, fontSize: 24, marginTop: 8 }}>
                  A group vault on
                  <img src={near} width={24} height={24} alt="" style={{ borderRadius: 999 }} />
                  NEAR
                </span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, color: C.text2, fontSize: 22 }}>
                {/* satori renders plain img */}
                <img src={usdc} width={30} height={30} alt="" />
                Vault value
              </span>
              <span style={{ fontSize: 72, fontWeight: 500, letterSpacing: -2, lineHeight: 1.1 }}>{value === null ? "—" : compact(Number(value) / 1e6)}</span>
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 40, border: `2px solid ${C.border}`, borderRadius: 18 }}>
            {stats.map(([label, v], i) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", flex: 1, padding: "18px 28px", borderLeft: i ? `2px solid ${C.border}` : "none" }}>
                <span style={{ color: C.text2, fontSize: 22 }}>{label}</span>
                <span style={{ fontSize: 34, fontWeight: 500, marginTop: 2 }}>{v}</span>
              </div>
            ))}
          </div>
          <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto", color: C.text2, fontSize: 24 }}>
            Trade together, win together
          </span>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}

// General Sans from Fontshare, the site font; satori needs ttf/otf/woff, so pick the ttf per weight
let fontCache: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 500 | 700; style: "normal" }[]> | null = null;
function generalSans() {
  fontCache ??= (async () => {
    const css = await (await fetch("https://api.fontshare.com/v2/css?f[]=general-sans@400,500,700&display=swap")).text();
    const faces = [...css.matchAll(/@font-face\s*{[^}]*}/g)].map((m) => m[0]);
    return Promise.all(
      ([400, 500, 700] as const).map(async (weight) => {
        const face = faces.find((f) => f.includes(`font-weight: ${weight}`));
        const url = face?.match(/url\('([^']+\.ttf)'\)/)?.[1];
        if (!url) throw new Error(`no ttf for ${weight}`);
        const data = await (await fetch(`https:${url}`)).arrayBuffer();
        return { name: "General Sans", data, weight, style: "normal" as const };
      }),
    );
  })();
  fontCache.catch(() => (fontCache = null)); // retry next time
  return fontCache;
}
