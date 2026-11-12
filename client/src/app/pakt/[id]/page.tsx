import type { Metadata } from "next";
import { Suspense } from "react";
import { PaktView } from "@/components/pakt/PaktView";
import Loading from "./loading";

// id = pakt name; params are awaited inside Suspense so unknown names get the shell first
async function Pakt({ params }: Pick<PageProps<"/pakt/[id]">, "params">) {
  const { id } = await params;
  return <PaktView key={id} name={id} />;
}

export async function generateMetadata({ params }: PageProps<"/pakt/[id]">): Promise<Metadata> {
  const { id } = await params;
  const description = `Join ${id} on Pakt: pool tUSDC with friends, vote in a pakter who can trade but never withdraw.`;
  return { title: `${id} · Pakt`, description, openGraph: { title: `Join ${id} on Pakt`, description }, twitter: { card: "summary_large_image", title: `Join ${id} on Pakt`, description } };
}

export default function PaktPage({ params }: PageProps<"/pakt/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Pakt params={params} />
    </Suspense>
  );
}
