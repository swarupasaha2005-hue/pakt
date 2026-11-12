import Image from "next/image";

type Props = { prominent?: boolean; decorative?: boolean };

export function BrandMark({ prominent = false, decorative = false }: Props) {
  return (
    <span className={`brand-mark${prominent ? " brand-mark--hero" : ""}`}>
      <Image
        src="/pakt-logo.jpg"
        width={1200}
        height={900}
        alt={decorative ? "" : "PAKT logo"}
        loading="eager"
        fetchPriority={prominent ? "high" : undefined}
        unoptimized
        className="brand-mark__source"
      />
    </span>
  );
}
