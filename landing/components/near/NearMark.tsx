import { useId } from "react";

export function NearMark({ decorative = false }: { decorative?: boolean }) {
  const id = useId();
  const outline = `${id}-outline`;
  const mask = `${id}-mask`;
  const gradient = `${id}-gradient`;

  return (
    <svg viewBox="0 0 500 500" className="near-mark" role={decorative ? undefined : "img"} aria-label={decorative ? undefined : "NEAR Protocol"} aria-hidden={decorative || undefined}>
      <defs>
        <filter id={outline} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -.2126 -.7152 -.0722 0 1" result="silhouette" />
          <feMorphology in="silhouette" operator="erode" radius="3" result="interior" />
          <feComposite in="silhouette" in2="interior" operator="out" />
        </filter>
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="500" height="500" style={{ maskType: "alpha" }}>
          <image href="/near-logo.webp" width="500" height="500" filter={`url(#${outline})`} />
        </mask>
        <linearGradient id={gradient} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--charcoal)" stopOpacity=".16" />
          <stop offset=".28" stopColor="var(--charcoal)" stopOpacity=".16" />
          <stop offset=".46" stopColor="var(--teal)" stopOpacity=".75" />
          <stop offset=".58" stopColor="var(--mint)" />
          <stop offset=".8" stopColor="var(--charcoal)" stopOpacity=".16" />
          <stop offset="1" stopColor="var(--charcoal)" stopOpacity=".16" />
        </linearGradient>
      </defs>
      <rect width="500" height="500" fill={`url(#${gradient})`} mask={`url(#${mask})`} />
    </svg>
  );
}
