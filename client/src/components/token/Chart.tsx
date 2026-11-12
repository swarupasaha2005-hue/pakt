"use client";

import { CandlestickSeries, createChart, type CandlestickData, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { usd } from "@/lib/format";
import type { Candle } from "@/lib/token/data";

type Props = { label: string; candles: Candle[] };

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** OHLC candles; the label shows the candle under the crosshair, else the latest */
export function Chart({ label, candles }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Candle | null>(null);
  const last = candles.at(-1)!;

  useEffect(() => {
    const [up, down, text, border] = ["--up", "--down", "--text-2", "--border"].map(css);
    const precision = Math.max(2, Math.ceil(-Math.log10(last.close)) + 3);
    const chart = createChart(box.current!, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: text, fontFamily: getComputedStyle(document.body).fontFamily, fontSize: 12, attributionLogo: false },
      grid: { vertLines: { color: border }, horzLines: { color: border } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: up, downColor: down, wickUpColor: up, wickDownColor: down, borderVisible: false,
      priceFormat: { type: "price", precision, minMove: 10 ** -precision },
    });
    series.priceScale().applyOptions({ scaleMargins: { top: 0.15, bottom: 0.1 } });
    series.setData(candles.map((c) => ({ ...c, time: c.time as UTCTimestamp })));
    chart.timeScale().fitContent();
    chart.subscribeCrosshairMove((p) => {
      const d = p.seriesData.get(series) as CandlestickData | undefined;
      setHover(d ? { time: Number(d.time), open: d.open, high: d.high, low: d.low, close: d.close } : null);
    });
    return () => chart.remove();
  }, [candles, last.close]);

  const c = hover ?? last;
  const tone = c.close < c.open ? "text-down" : "text-up";
  const delta = (c.close / c.open - 1) * 100;

  return (
    <div className="relative h-[360px] overflow-hidden">
      <div ref={box} className="size-full" />
      <p className="pointer-events-none absolute top-1 left-2 z-10 flex gap-2 text-xs text-text-2">
        <span className="text-text">{label}</span>
        <span>O <span className={tone}>{usd(c.open)}</span></span>
        <span>H <span className={tone}>{usd(c.high)}</span></span>
        <span>L <span className={tone}>{usd(c.low)}</span></span>
        <span>C <span className={tone}>{usd(c.close)}</span></span>
        <span className={tone}>{delta >= 0 && "+"}{delta.toFixed(2)}%</span>
      </p>
    </div>
  );
}
