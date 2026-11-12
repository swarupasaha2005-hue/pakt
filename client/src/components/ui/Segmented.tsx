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
          className={`h-[26px] shrink-0 rounded-lg border px-2.5 text-[13px] font-semibold transition-colors ${o === value ? "bg-panel-2 text-text" : "bg-panel text-text-2 hover:text-text"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
