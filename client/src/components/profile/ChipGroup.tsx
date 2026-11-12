type Props<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
};

/** joined chips in one bordered box; active = --panel-2 */
export function ChipGroup<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <div className="flex h-7 items-center rounded-lg border p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={`h-full rounded-md px-2 text-sm font-semibold transition-colors ${o === value ? "bg-panel-2 text-text" : "text-text-2 hover:text-text"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
