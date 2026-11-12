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
