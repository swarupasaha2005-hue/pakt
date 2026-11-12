"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** the toggle button; caller wires onClick + aria-expanded */
  trigger: ReactNode;
  /** width + horizontal anchor, e.g. "right-0 w-[218px]" */
  className: string;
  children: ReactNode;
};

/** panel hung 4px under its trigger; outside click and Escape close it */
export function Dropdown({ open, onOpenChange, trigger, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onOpenChange(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div className={`absolute top-full z-40 mt-1 rounded-2xl border bg-panel shadow-2xl shadow-black/60 ${className}`}>
          {children}
        </div>
      )}
    </div>
  );
}

/** row style shared by dropdown menus; add a height */
export const menuItem = "flex w-full items-center gap-2.5 rounded-lg px-2 text-left text-[15px] transition-colors hover:bg-panel-2";
