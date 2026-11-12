import { Pct } from "@/components/ui/Pct";
import { compact } from "@/lib/format";
import { changeIn, TIMEFRAMES } from "@/lib/mock/timeframes";
import { flow } from "@/lib/mock/trades";
import type { Token } from "@/lib/mock/types";

function Split({ left, right, a, b }: { left: string; right: string; a: number; b: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <div className="flex gap-1">
        <span className="h-1 rounded-full bg-up" style={{ flexGrow: a }} />
        <span className="h-1 rounded-full bg-down" style={{ flexGrow: b }} />
      </div>
    </div>
  );
}

export function AboutCard({ token: t }: { token: Token }) {
  const f = flow(t);
  return (
    <section className="space-y-4 border-b p-4">
      <div>
        <h2 className="text-lg font-medium">About {t.symbol}</h2>
        <p className="text-xs text-text-2">{t.name} · {t.allowed ? "on the Pakt whitelist" : "not on the Pakt whitelist"}</p>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {TIMEFRAMES.map((tf) => (
          <div key={tf} className="flex flex-col items-center rounded-lg bg-panel-2 py-1.5 text-xs">
            <span className="text-text-2 uppercase">{tf}</span>
            <Pct value={changeIn(t, tf)} />
          </div>
        ))}
      </div>
      <Split left={`${f.buys.toLocaleString("en-US")} buys`} right={`${f.sells.toLocaleString("en-US")} sells`} a={f.buys} b={f.sells} />
      <Split left={`${compact(f.buyVol)} vol.`} right={`${compact(f.sellVol)} vol.`} a={f.buyVol} b={f.sellVol} />
      <Split left={`${f.buyers.toLocaleString("en-US")} buyers`} right={`${f.sellers.toLocaleString("en-US")} sellers`} a={f.buyers} b={f.sellers} />
    </section>
  );
}
