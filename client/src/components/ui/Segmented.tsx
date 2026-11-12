type Props<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/** chip group; active = --panel-2 + --text */
export function Segmented<T extends string>({ options, value, onChange, className = "" }: Props<T>) {
  return (
    <div className={`flex gap-2 ${className}`}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={`h-6 shrink-0 rounded-md border border-chip px-1.5 text-xs font-bold transition-colors ${o === value ? "bg-chip text-text" : "text-text-2 hover:text-text"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
