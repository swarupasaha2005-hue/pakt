import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href: string;
  avatar: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  value: ReactNode;
  change: ReactNode;
  selected?: boolean;
};

/** 53px list row: avatar, title/subtitle left, value/change right */
export function Row({ href, avatar, title, subtitle, value, change, selected }: Props) {
  return (
    <Link
      href={href}
      className={`flex h-[53px] items-center gap-3 rounded-lg p-2 transition-colors ${selected ? "bg-panel-2" : "hover:bg-panel-2/60"}`}
    >
      {avatar}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5 truncate text-sm leading-5">{title}</span>
        <span className="truncate text-xs leading-5 text-text-2">{subtitle}</span>
      </span>
      <span className="flex flex-col items-end">
        <span className="text-sm leading-5">{value}</span>
        <span className="text-xs leading-5">{change}</span>
      </span>
    </Link>
  );
}
