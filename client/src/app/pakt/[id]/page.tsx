import { Suspense } from "react";
import { PaktView } from "@/components/pakt/PaktView";
import Loading from "./loading";

// id = pakt name; params are awaited inside Suspense so unknown names get the shell first
async function Pakt({ params }: Pick<PageProps<"/pakt/[id]">, "params">) {
  const { id } = await params;
  return <PaktView key={id} name={id} />;
}

export default function PaktPage({ params }: PageProps<"/pakt/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Pakt params={params} />
    </Suspense>
  );
}
