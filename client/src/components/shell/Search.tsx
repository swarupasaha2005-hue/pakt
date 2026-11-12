"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { SearchIcon } from "@/components/ui/icons";
import { compact, usd } from "@/lib/format";
import { loadPakts, loadTokens, useLoad } from "@/lib/home/data";
import { isAccountId } from "@/lib/profile/format";
import { match } from "@/lib/search/match";

const key = "flex size-6 items-center justify-center rounded-full bg-panel-2 font-sans text-xs text-text-2";
const chip = "flex h-[19px] items-center rounded px-1.5 text-[10px] leading-[15px] font-bold text-text-2 bg-[rgba(203,208,235,0.1)]";

/** top-bar search: focus opens a results panel over a dimmed page; cmd/ctrl+K focuses, Esc closes */
export function Search() {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const tokens = useLoad(open ? loadTokens : null, [open]);
  const pakts = useLoad(open ? loadPakts : null, [open]);
  const hits = match(q, tokens.data ?? [], pakts.data ?? []);
  const account = q.trim().toLowerCase();
  const first = hits.tokens[0] ? `/token/${hits.tokens[0].symbol}` : hits.pakts[0] ? `/pakt/${hits.pakts[0].name}` : hits.traders[0] ? `/u/${hits.traders[0]}` : isAccountId(account) ? `/u/${account}` : null;
  const loading = !tokens.data && !tokens.error;

  const close = () => {
    setOpen(false);
    setQ("");
    ref.current?.blur();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div data-tour="search" className="relative h-12 w-full max-w-[400px]">
      {open && <div aria-hidden onClick={close} className="fixed inset-0 z-40 animate-fade-in bg-black/50" />}
      <div className={`absolute z-50 rounded-xl ${open ? "-inset-x-2 -top-1.5 animate-fade-in border bg-panel p-1.5 shadow-[0_8px_24px_rgb(0_0_0/0.5)]" : "inset-x-0 top-0"}`}>
        <label className="flex h-12 items-center gap-2 rounded-xl border bg-bg px-3">
          <SearchIcon className="size-4 text-text-3" />
          <input
            ref={ref}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && first) {
                router.push(first);
                close();
              }
            }}
            placeholder="Search for tokens, pakts or traders…"
            className="min-w-0 flex-1 bg-transparent text-sm leading-[14px] outline-none placeholder:font-normal placeholder:text-text/50"
          />
          {open ? (
            <kbd className={`${chip} font-sans`}>ESC</kbd>
          ) : (
            <span className="flex gap-1.5" aria-label="Command K">
              <kbd className={key}>⌘</kbd>
              <kbd className={key}>K</kbd>
            </span>
          )}
        </label>
        {open && (
          <div className="max-h-[60vh] overflow-y-auto px-1 pt-3 pb-1">
            {loading ? (
              <p className="px-1 py-6 text-center text-sm text-text-3">Loading…</p>
            ) : (
              <>
                <Section title="Tokens" show={hits.tokens.length > 0}>
                  {hits.tokens.map((t) => (
                    <Hit key={t.id} href={`/token/${t.symbol}`} onPick={close} avatar={<Avatar name={t.symbol} src={t.logo} />} title={t.symbol} sub={t.id} value={t.price === null ? "—" : usd(t.price)} />
                  ))}
                </Section>
                <Section title="Pakts" show={hits.pakts.length > 0}>
                  {hits.pakts.map((p) => (
                    <Hit key={p.vault} href={`/pakt/${p.name}`} onPick={close} avatar={<Avatar name={p.name} />} title={p.name} sub={`${p.members} members · ${p.trader ? p.trader.account : "hiring"}`} value={p.value === null ? "—" : compact(p.value)} />
                  ))}
                </Section>
                <Section title="Traders" show={hits.traders.length > 0}>
                  {hits.traders.map((a) => (
                    <Hit key={a} href={`/u/${a}`} onPick={close} avatar={<Avatar name={a} />} title={a} sub="trader" />
                  ))}
                </Section>
                {!hits.tokens.length && !hits.pakts.length && !hits.traders.length && (
                  isAccountId(account) ? (
                    <Hit href={`/u/${account}`} onPick={close} avatar={<Avatar name={account} />} title={account} sub="Open profile" />
                  ) : (
                    <p className="px-1 py-6 text-center text-sm text-text-3">No results for “{q}”</p>
                  )
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, show, children }: { title: string; show: boolean; children: ReactNode }) {
  if (!show) return null;
  return (
    <section className="mb-2">
      <h3 className="px-1 pb-1 text-sm font-medium text-text-2">{title}</h3>
      {children}
    </section>
  );
}

function Hit({ href, onPick, avatar, title, sub, value }: { href: string; onPick: () => void; avatar: ReactNode; title: string; sub: string; value?: string }) {
  return (
    <Link href={href} onClick={onPick} className="flex h-[54px] items-center gap-3 rounded-lg px-1 hover:bg-panel-2">
      {avatar}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm leading-5 font-bold">{title}</span>
        <span className="truncate text-xs leading-4 text-text-2">{sub}</span>
      </span>
      {value && <span className="text-sm font-medium">{value}</span>}
    </Link>
  );
}
