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
export const ChevronDownIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>
);
export const ChevronRightIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="m9 6 6 6-6 6" /></Icon>
);
export const FilterIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M3 4h18l-7 8.5V19l-4 2v-8.5z" /></Icon>
);
export const PinIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v8" /></Icon>
);
export const HeartIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M12 20s-8-4.6-8-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.8C20 15.4 12 20 12 20" /></Icon>
);
export const UsersIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></Icon>
);
export const VolumeIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M11 5 6 9H3v6h3l5 4zM15.5 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /></Icon>
);
export const MuteIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M11 5 6 9H3v6h3l5 4zM16 9l5 6M21 9l-5 6" /></Icon>
);
