import { Avatar } from "@/components/ui/Avatar";
import { Pct } from "@/components/ui/Pct";
import { usd } from "@/lib/format";
import { tokens } from "@/lib/mock/tokens";

const TICKER = ["NEAR", "wBTC", "ETH", "USDC"];
const LINKS = ["Privacy", "Terms", "Help", "𝕏"];

export function Ticker() {
  return (
    <footer className="flex h-7 shrink-0 items-center justify-between px-3.5 text-[13px]">
      <ul className="flex items-center gap-4">
        {tokens
          .filter((t) => TICKER.includes(t.symbol))
          .map((t) => (
            <li key={t.symbol} className="flex items-center gap-1.5">
              <Avatar name={t.symbol} src={t.logo} size={14} />
              {usd(t.price)}
              <Pct value={t.change24h} />
            </li>
          ))}
      </ul>
      <nav className="flex items-center">
        <span className="flex items-center gap-1.5 pr-3 font-semibold text-up">
          <span className="size-1.5 rounded-full bg-up" />
          Testnet
        </span>
        {LINKS.map((l, i) => (
          <a key={l} href="#" className={`px-2 text-text-2 hover:text-text ${i === 0 ? "border-l pl-3" : ""}`}>
            {l}
          </a>
        ))}
      </nav>
    </footer>
  );
}
