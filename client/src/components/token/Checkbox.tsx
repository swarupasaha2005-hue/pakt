import { CheckIcon } from "@/components/ui/icons";

type Props = { label: string; checked: boolean; onChange: (checked: boolean) => void };

/** 16px accent square + label */
export function Checkbox({ label, checked, onChange }: Props) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-2 hover:text-text">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className={`flex size-4 items-center justify-center rounded border peer-focus-visible:ring-1 peer-focus-visible:ring-accent ${checked ? "border-accent bg-accent text-white" : "border-text-3"}`}
      >
        {checked && <CheckIcon className="size-3" strokeWidth={3} />}
      </span>
      <span className={checked ? "text-text" : ""}>{label}</span>
    </label>
  );
}
