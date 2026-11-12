import { SortIcon } from "@/components/ui/icons";

type Props = { label: string; active: boolean; desc: boolean; onClick: () => void };

export function SortHeader({ label, active, desc, onClick }: Props) {
  return (
    <th aria-sort={active ? (desc ? "descending" : "ascending") : "none"} className="px-3 text-left font-normal">
      <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 hover:text-text ${active ? "text-text" : ""}`}>
        {label}
        <SortIcon className="size-3.5 text-text-3" />
      </button>
    </th>
  );
}
