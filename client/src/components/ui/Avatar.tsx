import type { ReactNode } from "react";

type Props = {
  name: string;
  size?: number;
  /** solid fill (token icons); default = gradient from name */
  color?: string;
  /** default = initials */
  glyph?: string;
  /** 14px corner node, bottom-right */
  badge?: ReactNode;
};

function hue(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function Avatar({ name, size = 36, color, glyph, badge }: Props) {
  const h = hue(name);
  const background = color ?? `linear-gradient(135deg, hsl(${h} 70% 60%), hsl(${(h + 60) % 360} 70% 45%))`;
  const text = glyph ?? name.replace(/\..*$/, "").slice(0, 2).toUpperCase();
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        aria-hidden
        className="flex size-full items-center justify-center rounded-full font-semibold text-white"
        style={{ background, fontSize: size * 0.4 }}
      >
        {text}
      </span>
      {badge && (
        <span className="absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full ring-2 ring-panel">
          {badge}
        </span>
      )}
    </span>
  );
}
