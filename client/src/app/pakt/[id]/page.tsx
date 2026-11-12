import { notFound } from "next/navigation";
import { PaktView } from "@/components/pakt/PaktView";
import { pakts } from "@/lib/mock/pakts";

export function generateStaticParams() {
  return pakts.map((p) => ({ id: p.id }));
}

export default async function PaktPage({ params }: PageProps<"/pakt/[id]">) {
  const { id } = await params;
  const pakt = pakts.find((p) => p.id === id);
  if (!pakt) notFound();
  return <PaktView key={pakt.id} initial={pakt} />;
}
