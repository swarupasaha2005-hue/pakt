import { ChevronDownIcon } from "./icons";

type Props<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: string;
};

/** native select styled as a --panel-2 chip with ▾ */
export function Select<T extends string>({ options, value, onChange, label }: Props<T>) {
  return (
    <span className="relative inline-flex">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="field-sizing-content h-6 appearance-none rounded-lg bg-panel-2 pr-7 pl-2.5 text-xs font-bold text-text outline-none"
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-text-2" />
    </span>
  );
}
