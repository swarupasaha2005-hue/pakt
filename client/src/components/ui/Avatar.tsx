import type { ReactNode } from "react";
import { PixelAvatar } from "./PixelAvatar";

type Props = {
  name: string;
  size?: number;
  /** image url (token logos) */
  src?: string;
  /** solid fill + glyph fallback for tokens without a logo */
  color?: string;
  glyph?: string;
  /** 14px corner node, bottom-right */
  badge?: ReactNode;
};

export function Avatar({ name, size = 36, src, color, glyph, badge }: Props) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny static logos, next/image overkill
        <img src={src} alt="" width={size} height={size} className="size-full rounded-full object-cover" />
      ) : color || glyph ? (
        <span
          aria-hidden
          className="flex size-full items-center justify-center rounded-full font-bold text-white"
          style={{ background: color, fontSize: size * 0.4 }}
        >
          {glyph}
        </span>
      ) : (
        <PixelAvatar seed={name} />
      )}
      {badge && (
        <span className="absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full ring-2 ring-panel">
          {badge}
        </span>
      )}
    </span>
  );
}
