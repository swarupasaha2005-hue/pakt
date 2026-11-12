import { ChevronDownIcon } from "@/components/ui/icons";

type Props = {
  label: string;
  value: number;
  options: { value: number; label: string }[];
  onChange: (value: number) => void;
};

/** chip-styled native select */
export function FilterSelect({ label, value, options, onChange }: Props) {
  return (
    <span className="relative flex shrink-0">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-[26px] appearance-none rounded-lg border bg-panel pr-6 pl-2.5 text-xs font-bold text-text hover:bg-panel-2"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2 text-text-2" />
    </span>
  );
}
