"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

const KEY = "pakt:tour-done";
export const openTour = () => window.dispatchEvent(new Event("pakt:tour"));

// each step spotlights the element tagged data-tour="<spot>"; missing ones are skipped
const STEPS: { spot: string; tab?: string; title: string; body: string }[] = [
  { spot: "market", title: "Explore pakts", body: "Every pakt with its vault value, pakter and 7D share price. Your positions and tokens are one tab over." },
  { spot: "pins", title: "For you", body: "Pakter offers, votes waiting on you and your pakts, in one row." },
  { spot: "left", tab: "leaderboard", title: "Pakters", body: "Pakters are the traders a pakt hires. Members vote one in; they can trade the vault but never withdraw it. Ranked here by returns." },
  { spot: "left", tab: "feed", title: "Live feed", body: "Every deposit, trade and vote across pakts, as it lands on chain." },
  { spot: "left", tab: "pakts", title: "All pakts", body: "Browse every pakt with its pakter, fee and vault value." },
  { spot: "left", tab: "tokens", title: "Tokens", body: "Allowed tokens with live oracle prices. Hover one for details." },
  { spot: "search", title: "Find anything with ⌘K", body: "Tokens, pakts and pakters, or any NEAR account." },
  { spot: "create", title: "Start your own pakt", body: "One transaction deploys a vault and its DAO. Invite friends with a link." },
  { spot: "positions", title: "Your positions", body: "Each pakt you are in: your slice of the vault, its value, P/L and who trades it." },
  { spot: "help", title: "How it works", body: "The contracts behind a pakt. Replay this tour from here." },
];
const PAD = 6, CARD = 320;
const find = (spot: string) => document.querySelector<HTMLElement>(`[data-tour="${spot}"]`);

/** first-visit spotlight tour over the live UI; reopen with openTour() */
export function Tour() {
  const [steps, setSteps] = useState<typeof STEPS | null>(null);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const start = () => {
    setI(0);
    setSteps(STEPS.filter((s) => find(s.spot)));
  };
  useEffect(() => {
    let first = false;
    try {
      first = !localStorage.getItem(KEY);
    } catch {}
    const t = first ? setTimeout(start, 800) : undefined; // let the page lay out first
    window.addEventListener("pakt:tour", start);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pakt:tour", start);
    };
  }, []);

  const step = steps?.[i];
  useLayoutEffect(() => {
    if (!step) return;
    if (step.tab) window.dispatchEvent(new CustomEvent("pakt:tab", { detail: step.tab }));
    const measure = () => setRect(find(step.spot)?.getBoundingClientRect() ?? null);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [step]);

  const close = () => {
    setSteps(null);
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
  };
  useEffect(() => {
    if (!steps) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps]);

  if (!steps || !step || !rect) return null;
  const last = i === steps.length - 1;
  const vw = window.innerWidth, vh = window.innerHeight;
  // card goes below the target, else beside it, else above; clamped to the viewport
  const below = rect.bottom + PAD + 12;
  const right = rect.right + PAD + 12;
  const pos =
    vh - below > 200 ? { top: below, left: rect.left }
    : vw - right > CARD + 16 ? { top: rect.top, left: right }
    : { top: rect.top - PAD - 12 - 190, left: rect.left };
  const left = Math.max(16, Math.min(pos.left, vw - CARD - 16));
  const top = Math.max(16, Math.min(pos.top, vh - 200));

  return (
    <div role="dialog" aria-modal aria-label="Site tour" className="fixed inset-0 z-[60]">
      <div className="absolute inset-0" onClick={close} />
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-xl border-2 border-accent shadow-[0_0_0_9999px_rgb(0_0_0/0.65)] transition-all duration-300 ease-out"
        style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
      />
      <div
        key={i}
        className="absolute animate-fade-in overflow-hidden rounded-xl border bg-panel shadow-[0_8px_24px_rgb(0_0_0/0.5)] transition-all duration-300"
        style={{ top, left, width: CARD }}
      >
        <div className="h-0.5 bg-panel-2">
          <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="p-4">
          <h2 className="text-base font-medium">{step.title}</h2>
          <p className="mt-1 text-sm text-text-2">{step.body}</p>
          <div className="mt-4 flex items-center justify-between">
            <button type="button" onClick={close} className="text-sm text-text-2 hover:text-text">
              Skip · {i + 1}/{steps.length}
            </button>
            <span className="flex gap-2">
              {i > 0 && <Button onClick={() => setI(i - 1)} className="text-sm! font-medium!">Back</Button>}
              <Button variant="primary" onClick={() => (last ? close() : setI(i + 1))} className="min-w-20 text-sm! font-medium!">
                {last ? "Finish" : "Next"}
              </Button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
