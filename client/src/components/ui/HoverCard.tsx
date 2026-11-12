"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  /** trigger */
  children: ReactNode;
  card: ReactNode;
  openDelay?: number;
  closeDelay?: number;
  side?: "right" | "bottom";
  className?: string;
};

const GAP = 8;
const EXIT_MS = 120;

/** card shown next to its trigger on hover or focus; stays open while the pointer is over the card */
export function HoverCard({ children, card, openDelay = 300, closeDelay = 150, side = "right", className = "" }: Props) {
  const trigger = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // closing = exit animation playing, still mounted
  const [state, setState] = useState<"closed" | "open" | "closing">("closed");
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const schedule = (fn: () => void, ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };
  const show = () => schedule(() => setState("open"), openDelay);
  const hide = () =>
    schedule(() => {
      setState((s) => (s === "open" ? "closing" : s));
      timer.current = setTimeout(() => setState("closed"), EXIT_MS);
    }, closeDelay);
  const keep = () => {
    clearTimeout(timer.current);
    setState((s) => (s === "closing" ? "open" : s));
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  useLayoutEffect(() => {
    if (state !== "open" || !trigger.current || !panel.current) return;
    const t = trigger.current.getBoundingClientRect();
    const c = panel.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left: number;
    let top: number;
    if (side === "right") {
      left = t.right + GAP + c.width > vw ? t.left - GAP - c.width : t.right + GAP;
      top = t.top;
    } else {
      left = t.left;
      top = t.bottom + GAP + c.height > vh ? t.top - GAP - c.height : t.bottom + GAP;
    }
    setPos({ left: Math.max(GAP, Math.min(left, vw - c.width - GAP)), top: Math.max(GAP, Math.min(top, vh - c.height - GAP)) });
  }, [state, side]);

  return (
    <>
      <span ref={trigger} className={`inline-flex ${className}`} onPointerEnter={show} onPointerLeave={hide} onFocus={show} onBlur={hide}>
        {children}
      </span>
      {state !== "closed" &&
        createPortal(
          <div
            ref={panel}
            role="tooltip"
            onPointerEnter={keep}
            onPointerLeave={hide}
            className={`fixed z-50 w-[270px] rounded-xl border bg-panel p-3 shadow-[0_8px_24px_rgb(0_0_0/0.5)] ${state === "closing" ? "animate-hover-card-out" : "animate-hover-card-in"}`}
            style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0 }}
          >
            {card}
          </div>,
          document.body,
        )}
    </>
  );
}
