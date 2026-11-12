import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" aria-label="Pakt home" className="text-[30px] leading-6 font-bold tracking-tight">
      PAKT<span className="text-accent">.</span>
    </Link>
  );
}
