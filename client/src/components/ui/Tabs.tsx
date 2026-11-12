import type { ReactNode } from "react";

type Props<T extends string> = {
  items: { id: T; label: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
};

/** text tabs split by 1px dividers; active = --text */
export function Tabs<T extends string>({ items, value, onChange, className = "" }: Props<T>) {
  return (
    <div role="tablist" className={`flex items-center ${className}`}>
      {items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === value}
          onClick={() => onChange(item.id)}
          className={`flex h-full items-center px-1.5 leading-none transition-colors ${i > 0 ? "border-l" : ""} ${item.id === value ? "text-text" : "text-text-3 hover:text-text"}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
