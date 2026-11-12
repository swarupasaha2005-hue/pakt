import Link from "next/link";

// lowercase heavy wordmark, ~26px tall like the reference header
export function Logo() {
  return (
    <Link href="/" aria-label="Pakt home" className="text-[34px] leading-none font-black tracking-[-0.05em] lowercase">
      pakt
    </Link>
  );
}
