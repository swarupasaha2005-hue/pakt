import type { SVGProps } from "react";

// stroke icons, 24 grid, size via className
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      {children}
    </svg>
  );
}

export const BellIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></Icon>
);
export const StarIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></Icon>
);
export const SearchIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>
);
export const ChevronsLeftIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" /></Icon>
);
export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>
);
export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M20 6 9 17l-5-5" /></Icon>
);
export const SplitBottomIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 12h18M7 16h10" /></Icon>
);
export const SplitRightIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M12 4v16" /></Icon>
);
export const CopyIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></Icon>
);
export const UsersIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3" /></Icon>
);
export const SortIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="m8 9 4-4 4 4M8 15l4 4 4-4" /></Icon>
);
export const ChevronDownIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>
);
export const ExternalIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></Icon>
);
