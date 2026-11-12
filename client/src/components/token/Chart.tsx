"use client";

import {
  CandlestickSeries,
  createChart,
  HistogramSeries,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { usd } from "@/lib/format";
import { candles, NOW, type Candle, type ChartRange } from "@/lib/mock/candles";
import type { Trade } from "@/lib/mock/trades";
import type { Token } from "@/lib/mock/types";

type Props = { token: Token; range: ChartRange; trades: Trade[] };
type Bubble = { trade: Trade; x: number; y: number };
type Api = { chart: IChartApi; series: ISeriesApi<"Candlestick"> };

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const ts = (t: number) => t as UTCTimestamp;

/** candles + volume; trade bubbles are html avatars pinned to bar coordinates */
export function Chart({ token, range, trades }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const api = useRef<Api>(null);
  const data = useMemo(() => candles(token, range), [token, range]);
  const [legend, setLegend] = useState<Candle | CandlestickData | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  useEffect(() => {
    const [up, down, text, border] = ["--up", "--down", "--text-2", "--border"].map(css);
    const precision = Math.max(2, Math.ceil(-Math.log10(token.price)) + 3);
    const chart = createChart(box.current!, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: text, fontFamily: getComputedStyle(document.body).fontFamily, attributionLogo: false },
      grid: { vertLines: { color: border }, horzLines: { color: border } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: range === "1D" || range === "1W" },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: up, downColor: down, wickUpColor: up, wickDownColor: down, borderVisible: false,
      priceFormat: { type: "price", precision, minMove: 10 ** -precision },
    });
    series.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.25 } });
    series.setData(data.map((c) => ({ ...c, time: ts(c.time) })));
    const volume = chart.addSeries(HistogramSeries, { priceScaleId: "", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volume.setData(data.map((c) => ({ time: ts(c.time), value: c.volume, color: `${c.close >= c.open ? up : down}66` })));
    chart.timeScale().fitContent();
    chart.subscribeCrosshairMove((p) => setLegend((p.seriesData.get(series) as CandlestickData | undefined) ?? null));
    api.current = { chart, series };
    return () => chart.remove();
  }, [data, token.price, range]);

  useEffect(() => {
    const { chart, series } = api.current!;
    let frame = 0;
    // rAF: price scale re-fits after the range event fires
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setBubbles(
          trades.flatMap((trade) => {
            const bar = data.findLast((c) => c.time <= NOW - trade.secondsAgo) ?? data[0];
            const x = chart.timeScale().timeToCoordinate(ts(bar.time));
            const y = series.priceToCoordinate(bar.close);
            return x === null || y === null ? [] : [{ trade, x, y }];
          }),
        ),
      );
    };
    place();
    chart.timeScale().subscribeVisibleLogicalRangeChange(place);
    chart.timeScale().subscribeSizeChange(place);
    return () => {
      cancelAnimationFrame(frame);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(place);
      chart.timeScale().unsubscribeSizeChange(place);
    };
  }, [data, trades]);

  const bar = legend ?? data.at(-1)!;
  const delta = (bar.close / bar.open - 1) * 100;

  return (
    <div className="relative h-[360px] overflow-hidden">
      <div ref={box} className="size-full" />
      <p className="pointer-events-none absolute top-1 left-2 z-10 flex gap-2 text-xs text-text-2">
        <span className="text-text">{token.symbol} · {range} · Rhea</span>
        {(["open", "high", "low", "close"] as const).map((k) => (
          <span key={k} className="flex gap-0.5">
            {k[0].toUpperCase()}
            <span className={delta < 0 ? "text-down" : "text-up"}>{usd(bar[k])}</span>
          </span>
        ))}
        <span className={delta < 0 ? "text-down" : "text-up"}>{delta >= 0 && "+"}{delta.toFixed(2)}%</span>
      </p>
      {bubbles.map(({ trade, x, y }) => (
        <span
          key={trade.id}
          title={`${trade.account} ${trade.side === "buy" ? "bought" : "sold"} ${usd(trade.usd)}`}
          className={`absolute z-10 -translate-1/2 rounded-full ring-2 ${trade.side === "buy" ? "ring-up" : "ring-down"}`}
          style={{ left: x, top: y }}
        >
          <Avatar name={trade.account} size={24} />
        </span>
      ))}
    </div>
  );
}
