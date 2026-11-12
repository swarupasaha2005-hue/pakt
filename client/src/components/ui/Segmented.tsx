"use client";

import { useLayoutEffect, useRef, useState } from "react";

type Props<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** bordered control with one sliding active pill (time windows) instead of separate chips */
  pill?: boolean;
};

const chip = "h-6 shrink-0 rounded-md border border-chip px-1.5 text-xs font-bold transition-[padding,color,background-color] duration-150 ease-[cubic-bezier(0,0,0.2,1)]";

/** chip group; active = --chip + --text. `pill` = segmented control with a sliding indicator */
export function Segmented<T extends string>({ options, value, onChange, className = "", pill }: Props<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  const index = options.indexOf(value);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!pill || !el) return;
    const measure = () => {
      const btn = el.querySelectorAll("button")[index];
      setBox(btn ? { left: btn.offsetLeft, width: btn.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pill, index, options.length]);

  if (!pill) {
    return (
      <div className={`flex gap-2 ${className}`}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={o === value}
            onClick={() => onChange(o)}
            className={`${chip} ${o === value ? "bg-chip text-text" : "text-text-2 hover:text-text"}`}
          >
            {o}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} className={`relative flex shrink-0 rounded-lg border p-0.5 ${className}`}>
      {box && (
        <span
          aria-hidden
          className="absolute top-0.5 left-0 h-6 rounded-md bg-chip transition-[transform,width] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
          style={{ width: box.width, transform: `translateX(${box.left}px)` }}
        />
      )}
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={`relative h-6 shrink-0 px-1.5 text-xs font-bold transition-colors duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] ${o === value ? "text-text" : "text-text-2 hover:text-text"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
