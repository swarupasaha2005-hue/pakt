import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary: "bg-accent text-white hover:brightness-110",
  secondary: "bg-panel-2 text-text hover:bg-border",
  up: "bg-up-bg text-up hover:brightness-125",
  outline: "border bg-panel text-text-2 hover:text-text",
  down: "bg-down text-white hover:brightness-110",
  "down-outline": "border border-down text-down hover:bg-down/10",
};

const sizes = {
  sm: "h-6 rounded-lg px-2 text-[13px]",
  md: "h-10 rounded-xl px-4 text-sm",
  lg: "h-[52px] rounded-xl px-5 text-base",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function Button({ variant = "secondary", size = "md", className = "", ...props }: Props) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 font-semibold transition disabled:bg-panel-2 disabled:text-text-3 disabled:brightness-100 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
